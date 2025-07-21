from flask import Blueprint, jsonify, request
from flask_cors import cross_origin
import math

ngn_bp = Blueprint('ngn', __name__)

# Configuration des codecs avec leurs caractéristiques
CODECS_CONFIG = {
    'G.711': {
        'debit_vocal_kbps': 64,
        'taille_charge_utile_octets': 160,
        'intervalle_paquet_ms': 20,
        'taille_entetes_octets': 40  # IP(20) + UDP(8) + RTP(12)
    },
    'G.729': {
        'debit_vocal_kbps': 8,
        'taille_charge_utile_octets': 20,
        'intervalle_paquet_ms': 20,
        'taille_entetes_octets': 40
    },
    'G.722': {
        'debit_vocal_kbps': 64,
        'taille_charge_utile_octets': 160,
        'intervalle_paquet_ms': 20,
        'taille_entetes_octets': 40
    },
    'Opus': {
        'debit_vocal_kbps': 32,
        'taille_charge_utile_octets': 80,
        'intervalle_paquet_ms': 20,
        'taille_entetes_octets': 40
    }
}

def calcul_trafic_erlangs(nombre_abonnes, pourcentage_appels_simultanes, duree_moyenne_appels_secondes):
    """
    Calcule le trafic total en Erlangs
    A = (N * T_appel) / T_heure
    """
    nombre_appels_simultanes = nombre_abonnes * pourcentage_appels_simultanes
    trafic_erlangs = (nombre_appels_simultanes * duree_moyenne_appels_secondes) / 3600
    return trafic_erlangs

def calcul_bande_passante_par_appel(codec):
    """
    Calcule la bande passante consommée par un appel selon le codec
    """
    if codec not in CODECS_CONFIG:
        raise ValueError(f"Codec {codec} non supporté")
    
    config = CODECS_CONFIG[codec]
    taille_paquet_total = config['taille_charge_utile_octets'] + config['taille_entetes_octets']
    intervalle_paquet_s = config['intervalle_paquet_ms'] / 1000
    
    # Bande passante en bits/seconde
    bande_passante_bps = (taille_paquet_total * 8) / intervalle_paquet_s
    # Conversion en kbps
    bande_passante_kbps = bande_passante_bps / 1000
    
    return bande_passante_kbps

def erlang_b(trafic_erlangs, nombre_circuits):
    """
    Calcule la probabilité de blocage selon la formule d'Erlang B
    P_b(A, C) = (A^C / C!) / sum(A^i / i!) pour i de 0 à C
    """
    if nombre_circuits == 0:
        return 1.0
    
    # Calcul du numérateur: A^C / C!
    numerateur = (trafic_erlangs ** nombre_circuits) / math.factorial(nombre_circuits)
    
    # Calcul du dénominateur: somme de A^i / i! pour i de 0 à C
    denominateur = 0
    for i in range(nombre_circuits + 1):
        denominateur += (trafic_erlangs ** i) / math.factorial(i)
    
    probabilite_blocage = numerateur / denominateur
    return probabilite_blocage

def calcul_circuits_necessaires(trafic_erlangs, gos_cible, max_circuits=1000):
    """
    Calcule le nombre de circuits nécessaires pour atteindre le GOS cible
    Utilise une recherche itérative
    """
    for circuits in range(1, max_circuits + 1):
        gos_actuel = erlang_b(trafic_erlangs, circuits)
        if gos_actuel <= gos_cible:
            return circuits
    
    # Si aucune solution trouvée dans la limite
    return max_circuits

def calcul_mos_estime(latence_ms, jitter_ms, perte_paquets_pourcentage, codec):
    """
    Estimation simplifiée du MOS basée sur l'E-model
    Cette implémentation est une approximation
    """
    # Facteur de base selon le codec
    r0_base = {
        'G.711': 93.2,
        'G.729': 83.0,
        'G.722': 92.0,
        'Opus': 88.0
    }
    
    r0 = r0_base.get(codec, 85.0)
    
    # Pénalités dues à la latence (Id)
    if latence_ms <= 150:
        id_latence = 0
    else:
        id_latence = 0.024 * latence_ms + 0.11 * (latence_ms - 177.3)
    
    # Pénalités dues au jitter (approximation)
    id_jitter = jitter_ms * 0.1
    
    # Pénalités dues aux pertes de paquets (Ie)
    ie_pertes = 95 * perte_paquets_pourcentage
    
    # Calcul du R-factor
    r_factor = r0 - id_latence - id_jitter - ie_pertes
    
    # Conversion R-factor vers MOS
    if r_factor < 0:
        mos = 1.0
    elif r_factor > 100:
        mos = 4.5
    else:
        mos = 1 + 0.035 * r_factor + 7e-6 * r_factor * (r_factor - 60) * (100 - r_factor)
    
    return max(1.0, min(5.0, mos)), r_factor

@ngn_bp.route('/dimensionnement', methods=['POST'])
@cross_origin()
def calcul_dimensionnement():
    """
    API principale pour le calcul de dimensionnement NGN
    """
    try:
        data = request.json
        
        # Validation des données d'entrée
        required_fields = [
            'nombre_abonnes', 
            'moyenne_appels_simultanes_pourcentage',
            'duree_moyenne_appels_secondes',
            'codec',
            'bande_passante_disponible_mbps',
            'gos_cible'
        ]
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Champ requis manquant: {field}'}), 400
        
        # Extraction des paramètres
        nombre_abonnes = int(data['nombre_abonnes'])
        pourcentage_appels_simultanes = float(data['moyenne_appels_simultanes_pourcentage'])
        duree_moyenne_appels_secondes = int(data['duree_moyenne_appels_secondes'])
        codec = data['codec']
        bande_passante_disponible_mbps = float(data['bande_passante_disponible_mbps'])
        gos_cible = float(data['gos_cible'])
        
        # Validation des valeurs
        if codec not in CODECS_CONFIG:
            return jsonify({'error': f'Codec non supporté: {codec}'}), 400
        
        if nombre_abonnes <= 0 or pourcentage_appels_simultanes <= 0 or duree_moyenne_appels_secondes <= 0:
            return jsonify({'error': 'Les valeurs doivent être positives'}), 400
        
        # Calculs
        trafic_erlangs = calcul_trafic_erlangs(
            nombre_abonnes, 
            pourcentage_appels_simultanes, 
            duree_moyenne_appels_secondes
        )
        
        nombre_circuits_necessaires = calcul_circuits_necessaires(trafic_erlangs, gos_cible)
        
        bande_passante_par_appel_kbps = calcul_bande_passante_par_appel(codec)
        nombre_appels_simultanes = nombre_abonnes * pourcentage_appels_simultanes
        bande_passante_consommee_mbps = (nombre_appels_simultanes * bande_passante_par_appel_kbps) / 1000
        
        gos_estime = erlang_b(trafic_erlangs, nombre_circuits_necessaires)
        
        # Vérification de la capacité
        capacite_suffisante = bande_passante_consommee_mbps <= bande_passante_disponible_mbps
        
        # Préparation de la réponse
        response = {
            'trafic_erlangs': round(trafic_erlangs, 2),
            'nombre_circuits_necessaires': nombre_circuits_necessaires,
            'bande_passante_consommee_mbps': round(bande_passante_consommee_mbps, 2),
            'gos_estime': round(gos_estime, 6),
            'nombre_trunks_a_prevoir': nombre_circuits_necessaires,
            'capacite_suffisante': capacite_suffisante,
            'details_calculs': {
                'codec_info': {
                    'debit_vocal_kbps': CODECS_CONFIG[codec]['debit_vocal_kbps'],
                    'bande_passante_par_appel_kbps': round(bande_passante_par_appel_kbps, 2)
                },
                'nombre_appels_simultanes': round(nombre_appels_simultanes, 0),
                'bande_passante_disponible_mbps': bande_passante_disponible_mbps
            }
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'error': f'Erreur lors du calcul: {str(e)}'}), 500

@ngn_bp.route('/mos', methods=['POST'])
@cross_origin()
def calcul_mos():
    """
    API pour le calcul du MOS (Mean Opinion Score)
    """
    try:
        data = request.json
        
        # Validation des données d'entrée
        required_fields = ['latence_ms', 'jitter_ms', 'perte_paquets_pourcentage', 'codec']
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Champ requis manquant: {field}'}), 400
        
        # Extraction des paramètres
        latence_ms = int(data['latence_ms'])
        jitter_ms = int(data['jitter_ms'])
        perte_paquets_pourcentage = float(data['perte_paquets_pourcentage'])
        codec = data['codec']
        
        # Validation des valeurs
        if codec not in CODECS_CONFIG:
            return jsonify({'error': f'Codec non supporté: {codec}'}), 400
        
        if latence_ms < 0 or jitter_ms < 0 or perte_paquets_pourcentage < 0:
            return jsonify({'error': 'Les valeurs ne peuvent pas être négatives'}), 400
        
        # Calcul du MOS
        mos_estime, r_factor = calcul_mos_estime(latence_ms, jitter_ms, perte_paquets_pourcentage, codec)
        
        # Préparation de la réponse
        response = {
            'mos_estime': round(mos_estime, 2),
            'r_factor': round(r_factor, 1),
            'qualite_vocale': 'Excellente' if mos_estime >= 4.0 else 
                            'Bonne' if mos_estime >= 3.5 else
                            'Acceptable' if mos_estime >= 3.0 else
                            'Médiocre' if mos_estime >= 2.0 else 'Mauvaise'
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'error': f'Erreur lors du calcul MOS: {str(e)}'}), 500

@ngn_bp.route('/codecs', methods=['GET'])
@cross_origin()
def get_codecs():
    """
    API pour obtenir la liste des codecs supportés
    """
    codecs_info = {}
    for codec, config in CODECS_CONFIG.items():
        bande_passante_kbps = calcul_bande_passante_par_appel(codec)
        codecs_info[codec] = {
            'debit_vocal_kbps': config['debit_vocal_kbps'],
            'bande_passante_totale_kbps': round(bande_passante_kbps, 2),
            'description': f"{codec} - {config['debit_vocal_kbps']} kbps"
        }
    
    return jsonify(codecs_info)

