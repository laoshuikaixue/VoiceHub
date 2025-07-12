export interface User {
  id: number
  email: string
  name: string | null
  role: 'USER' | 'ADMIN'
}

export interface Song {
  id: number
  title: string
  artist: string
  requester: string
  voteCount: number
  played: boolean
  playedAt: string | null
  semester: string | null
  createdAt: string
}

export interface Schedule {
  id: number
  playDate: string
  song: {
    id: number
    title: string
    artist: string
    requester: string
    voteCount: number
  }
} 