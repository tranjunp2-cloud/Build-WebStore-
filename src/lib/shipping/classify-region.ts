import { isEastState } from './calculate-fee'

export function classifyRegion(state: string | null | undefined): 'west' | 'east' {
    return state && isEastState(state) ? 'east' : 'west'
}
