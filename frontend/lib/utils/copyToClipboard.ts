/**
 * Copy text to clipboard with fallback support for legacy browsers
 * @param text - The text to copy to clipboard
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Check if clipboard API is available (modern browsers)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Failed to copy using clipboard API:", err);
      // Fall through to fallback method
    }
  }

  // Fallback for older browsers or insecure contexts
  try {
    // Create a temporary textarea element
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-999999px";
    textarea.style.top = "-999999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    // Use execCommand as fallback
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!successful) {
      console.error("execCommand('copy') failed");
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to copy using fallback method:", err);
    return false;
  }
}

