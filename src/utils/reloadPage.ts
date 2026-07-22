// Indirección mínima sobre window.location.reload() para poder mockearla en
// tests (jsdom no permite espiar location.reload directamente).
export function reloadPage(): void {
  window.location.reload();
}
