export type PluginProtocol = 'auto' | 'lx' | 'musicfree'
export interface PluginCapability {
  protocol: Exclude<PluginProtocol, 'auto'>
  name: string
  sources: Record<string, { actions: string[]; qualities: string[] }>
  search: boolean
  lyric: boolean
  variables: { key: string; name?: string; hint?: string }[]
}
export interface PluginArtifact {
  id: string
  revision: number
  hash: string
  source: string
  protocol: PluginProtocol
  capability: PluginCapability
}
export interface PluginTrack {
  schemaVersion: 1
  pluginId?: string
  catalog: string
  externalId: string
  title: string
  artist: string
  album?: string
  duration?: number
  item?: Record<string, any>
}
export interface PluginManifest {
  mode: 'hot' | 'snapshot'
  buildId: string
  prelude: string
  artifacts: PluginArtifact[]
}
