export function asciiCard(card) {
  const title = [card.perfumeName, card.family].filter(Boolean).join(' · ');
  const body = (card.ascii || '').replace(/\r/g, '');
  return `${title}\n${'─'.repeat(Math.max(title.length, 8))}\n${body}`;
}
