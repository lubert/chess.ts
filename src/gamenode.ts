import { TreeNode } from 'treenode.ts';
import { GameState } from './interfaces/types';

export function isMainline(node: TreeNode<GameState>): boolean {
  while (node.parent) {
    let parent = node.parent
    if (parent.children[0] !== node) {
      return false
    }
    node = parent
  }
  return true
}

export function addNag(node: TreeNode<GameState>, nag: number) {
  if (!node.model.nags) {
    node.model.nags = [nag]
    return
  }
  node.model.nags = Array.from(new Set<number>([...node.model.nags, nag]))
}
