import { GameNode, ValueOrArray } from './interfaces/types'
import { makePretty } from './move'

export function isMainline(node: GameNode): boolean {
  while (node.parent) {
    const parent = node.parent
    if (parent.children[0] !== node) {
      return false
    }
    node = parent
  }
  return true
}

export function addNag(node: GameNode, nag: number) {
  if (!node.model.nags) {
    node.model.nags = [nag]
    return
  }
  node.model.nags = Array.from(new Set<number>([...node.model.nags, nag]))
}

export function toSan(node: GameNode): string {
  if (node.parent && node.model.move) {
    return makePretty(node.parent.model.boardState, node.model.move).san
  }
  return ''
}

export function toString(node: GameNode): string {
  return JSON.stringify(node.map((node) => toSan(node)).toObject(), null, 2)
}

// [e4, [e5, [e6]], Nc3, Nc6]
export function toNestedArray(node: GameNode): ValueOrArray<GameNode> {
  const list = []
  if (node.children.length > 1) {
    list.push(...node.children.map((child) => toNestedArray(child)))
  } else {
    list.push(node.children[0])
  }
  return list
}
