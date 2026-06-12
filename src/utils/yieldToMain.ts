/** Libera a thread principal para a UI respirar entre cálculos pesados. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
