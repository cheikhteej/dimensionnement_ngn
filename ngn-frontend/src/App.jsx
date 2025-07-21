import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { AlertCircle, Calculator, Network, Phone, Settings, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import './App.css'

function App() {
  const [formData, setFormData] = useState({
    nombre_abonnes: 10000,
    moyenne_appels_simultanes_pourcentage: 0.15,
    duree_moyenne_appels_secondes: 180,
    codec: 'G.711',
    bande_passante_disponible_mbps: 100,
    gos_cible: 0.01
  })

  const [results, setResults] = useState(null)
  const [mosData, setMosData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const codecs = [
    { value: 'G.711', label: 'G.711 (64 kbps)' },
    { value: 'G.729', label: 'G.729 (8 kbps)' },
    { value: 'G.722', label: 'G.722 (64 kbps)' },
    { value: 'Opus', label: 'Opus (32 kbps)' }
  ]

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const calculateDimensioning = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch("http://localhost:5000/api/dimensionnement", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Erreur lors du calcul')
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const calculateMOS = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/mos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latence_ms: 100,
          jitter_ms: 20,
          perte_paquets_pourcentage: 0.01,
          codec: formData.codec
        })
      })

      if (!response.ok) {
        throw new Error('Erreur lors du calcul MOS')
      }

      const data = await response.json()
      setMosData(data)
    } catch (err) {
      console.error('Erreur MOS:', err)
    }
  }

  const chartData = results ? [
    { name: 'Trafic (Erlangs)', value: results.trafic_erlangs },
    { name: 'Circuits nécessaires', value: results.nombre_circuits_necessaires },
    { name: 'Bande passante (Mbps)', value: results.bande_passante_consommee_mbps }
  ] : []

  const pieData = results ? [
    { name: 'Utilisée', value: results.bande_passante_consommee_mbps, color: '#8884d8' },
    { name: 'Disponible', value: Math.max(0, formData.bande_passante_disponible_mbps - results.bande_passante_consommee_mbps), color: '#82ca9d' }
  ] : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Network className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Outil de Dimensionnement NGN</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Calculez le trafic téléphonique, dimensionnez vos circuits et optimisez votre réseau de nouvelle génération
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panneau de saisie */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Paramètres d'entrée
                </CardTitle>
                <CardDescription>
                  Configurez les paramètres de votre réseau NGN
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="abonnes">Nombre d'abonnés</Label>
                  <Input
                    id="abonnes"
                    type="number"
                    value={formData.nombre_abonnes}
                    onChange={(e) => handleInputChange('nombre_abonnes', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="simultanes">Appels simultanés (%)</Label>
                  <Input
                    id="simultanes"
                    type="number"
                    step="0.01"
                    value={formData.moyenne_appels_simultanes_pourcentage}
                    onChange={(e) => handleInputChange('moyenne_appels_simultanes_pourcentage', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duree">Durée moyenne (secondes)</Label>
                  <Input
                    id="duree"
                    type="number"
                    value={formData.duree_moyenne_appels_secondes}
                    onChange={(e) => handleInputChange('duree_moyenne_appels_secondes', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codec">Codec vocal</Label>
                  <Select value={formData.codec} onValueChange={(value) => handleInputChange('codec', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un codec" />
                    </SelectTrigger>
                    <SelectContent>
                      {codecs.map((codec) => (
                        <SelectItem key={codec.value} value={codec.value}>
                          {codec.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bande_passante">Bande passante disponible (Mbps)</Label>
                  <Input
                    id="bande_passante"
                    type="number"
                    step="0.1"
                    value={formData.bande_passante_disponible_mbps}
                    onChange={(e) => handleInputChange('bande_passante_disponible_mbps', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gos">GOS cible</Label>
                  <Input
                    id="gos"
                    type="number"
                    step="0.001"
                    value={formData.gos_cible}
                    onChange={(e) => handleInputChange('gos_cible', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <Button 
                  onClick={calculateDimensioning} 
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  {loading ? 'Calcul en cours...' : 'Calculer le dimensionnement'}
                </Button>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panneau des résultats */}
          <div className="lg:col-span-2">
            {results ? (
              <Tabs defaultValue="results" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="results">Résultats</TabsTrigger>
                  <TabsTrigger value="charts">Graphiques</TabsTrigger>
                  <TabsTrigger value="qos" onClick={calculateMOS}>Qualité (MOS)</TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                          Trafic et Circuits
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Trafic total</span>
                          <Badge variant="secondary">{results.trafic_erlangs} Erlangs</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Circuits nécessaires</span>
                          <Badge variant="secondary">{results.nombre_circuits_necessaires}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Trunks à prévoir</span>
                          <Badge variant="secondary">{results.nombre_trunks_a_prevoir}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">GOS estimé</span>
                          <Badge variant={results.gos_estime <= formData.gos_cible ? "default" : "destructive"}>
                            {(results.gos_estime * 100).toFixed(3)}%
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Network className="h-5 w-5 text-green-600" />
                          Bande Passante
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Consommée</span>
                          <Badge variant="secondary">{results.bande_passante_consommee_mbps} Mbps</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Disponible</span>
                          <Badge variant="secondary">{formData.bande_passante_disponible_mbps} Mbps</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Capacité suffisante</span>
                          <Badge variant={results.capacite_suffisante ? "default" : "destructive"}>
                            {results.capacite_suffisante ? "Oui" : "Non"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Par appel</span>
                          <Badge variant="outline">
                            {results.details_calculs.codec_info.bande_passante_par_appel_kbps} kbps
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Détails des calculs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Appels simultanés:</span>
                          <p className="text-gray-600">{results.details_calculs.nombre_appels_simultanes}</p>
                        </div>
                        <div>
                          <span className="font-medium">Codec sélectionné:</span>
                          <p className="text-gray-600">{formData.codec} ({results.details_calculs.codec_info.debit_vocal_kbps} kbps)</p>
                        </div>
                        <div>
                          <span className="font-medium">Utilisation:</span>
                          <p className="text-gray-600">
                            {((results.bande_passante_consommee_mbps / formData.bande_passante_disponible_mbps) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="charts" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Métriques principales</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Utilisation de la bande passante</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value.toFixed(1)} Mbps`}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="qos" className="space-y-4">
                  {mosData ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Phone className="h-5 w-5 text-purple-600" />
                          Qualité de Service (MOS)
                        </CardTitle>
                        <CardDescription>
                          Estimation basée sur des paramètres QoS typiques
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-purple-600">{mosData.mos_estime}</div>
                            <div className="text-sm text-gray-600">Score MOS</div>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{mosData.r_factor}</div>
                            <div className="text-sm text-gray-600">Facteur R</div>
                          </div>
                          <div className="text-center">
                            <Badge variant="default" className="text-lg px-4 py-2">
                              {mosData.qualite_vocale}
                            </Badge>
                            <div className="text-sm text-gray-600 mt-1">Qualité vocale</div>
                          </div>
                        </div>
                        <Separator />
                        <div className="text-sm text-gray-600">
                          <p><strong>Paramètres utilisés:</strong></p>
                          <p>• Latence: 100ms • Jitter: 20ms • Perte de paquets: 1% • Codec: {formData.codec}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-gray-600">Cliquez sur l'onglet pour calculer le MOS</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="h-96 flex items-center justify-center">
                <CardContent className="text-center">
                  <Network className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Prêt pour le calcul</h3>
                  <p className="text-gray-600">
                    Configurez les paramètres et cliquez sur "Calculer le dimensionnement" pour voir les résultats
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

