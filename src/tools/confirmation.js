const previewedAt = new Map(); 
let currentTurn = 0;

export function nextTurn() {
  currentTurn += 1;
}

export function checkConfirmation(key, confirmed) {
  const cleanKey = key.toLowerCase();
  if (confirmed) {
    const turn = previewedAt.get(cleanKey);
    if (turn !== undefined && turn < currentTurn) {
      previewedAt.delete(cleanKey);
      return { dryRun: false };
    }
  }
  previewedAt.set(cleanKey, currentTurn);
  return { dryRun: true };
}
export function withGate(gate, result) {
  if (!gate.dryRun) return result;
  return { ...result, needs_user_confirmation: true };
}
