export async function withPreservedScroll<T>(
  sectionId: string | null,
  action: () => Promise<T>,
): Promise<T> {
  const scrollY = window.scrollY;
  const result = await action();
  requestAnimationFrame(() => {
    window.scrollTo(0, scrollY);
    if (sectionId) {
      document.getElementById(sectionId)?.scrollIntoView({ block: "nearest" });
    }
  });
  return result;
}
