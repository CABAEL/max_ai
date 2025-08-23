import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { speak } from './tts.js';

const execAsync = promisify(exec);

/**
 * Mouse and keyboard control utilities using PowerShell and Windows APIs
 */

/**
 * Get current mouse position
 * @returns {Promise<{x: number, y: number}>} Mouse coordinates
 */
export async function getMousePosition() {
  try {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      $pos = [System.Windows.Forms.Cursor]::Position;
      Write-Output "$($pos.X),$($pos.Y)"
    `;
    const { stdout } = await execAsync(`powershell -Command "${psScript}"`);
    const [x, y] = stdout.trim().split(',').map(Number);
    return { x, y };
  } catch (error) {
    throw new Error(`Error getting mouse position: ${error.message}`);
  }
}

/**
 * Move mouse to specific coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Promise<string>} Result message
 */
export async function moveMouse(x, y) {
  try {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y});
      Write-Output "Mouse moved to ${x}, ${y}"
    `;
    const { stdout } = await execAsync(`powershell -Command "${psScript}"`);
    return stdout.trim();
  } catch (error) {
    throw new Error(`Error moving mouse: ${error.message}`);
  }
}

/**
 * Perform mouse click
 * @param {string} button - 'left', 'right', or 'middle'
 * @param {number} x - X coordinate (optional)
 * @param {number} y - Y coordinate (optional)
 * @returns {Promise<string>} Result message
 */
export async function mouseClick(button = 'left', x = null, y = null) {
  try {
    let psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      Add-Type -AssemblyName System.Drawing;
    `;
    
    // Move to coordinates if specified
    if (x !== null && y !== null) {
      psScript += `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y});`;
    }
    
    // Perform click based on button type
    switch (button.toLowerCase()) {
      case 'left':
        psScript += `
          [System.Windows.Forms.Application]::DoEvents();
          $signature = '[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)] public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);';
          $SendMouseClick = Add-Type -memberDefinition $signature -name "Win32MouseEventNew" -namespace Win32Functions -passThru;
          $SendMouseClick::mouse_event(0x00000002, 0, 0, 0, 0);
          $SendMouseClick::mouse_event(0x00000004, 0, 0, 0, 0);
        `;
        break;
      case 'right':
        psScript += `
          [System.Windows.Forms.Application]::DoEvents();
          $signature = '[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)] public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);';
          $SendMouseClick = Add-Type -memberDefinition $signature -name "Win32MouseEventNew" -namespace Win32Functions -passThru;
          $SendMouseClick::mouse_event(0x00000008, 0, 0, 0, 0);
          $SendMouseClick::mouse_event(0x00000010, 0, 0, 0, 0);
        `;
        break;
      case 'double':
        psScript += `
          [System.Windows.Forms.Application]::DoEvents();
          $signature = '[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)] public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);';
          $SendMouseClick = Add-Type -memberDefinition $signature -name "Win32MouseEventNew" -namespace Win32Functions -passThru;
          $SendMouseClick::mouse_event(0x00000002, 0, 0, 0, 0);
          $SendMouseClick::mouse_event(0x00000004, 0, 0, 0, 0);
          Start-Sleep -Milliseconds 50;
          $SendMouseClick::mouse_event(0x00000002, 0, 0, 0, 0);
          $SendMouseClick::mouse_event(0x00000004, 0, 0, 0, 0);
        `;
        break;
    }
    
    const { stdout } = await execAsync(`powershell -Command "${psScript}"`);
    const position = x !== null && y !== null ? ` at ${x}, ${y}` : '';
    return `${button} mouse click performed${position}`;
  } catch (error) {
    throw new Error(`Error performing mouse click: ${error.message}`);
  }
}

/**
 * Scroll mouse wheel
 * @param {string} direction - 'up' or 'down'
 * @param {number} clicks - Number of scroll clicks
 * @returns {Promise<string>} Result message
 */
export async function mouseScroll(direction = 'down', clicks = 3) {
  try {
    const wheelDelta = direction.toLowerCase() === 'up' ? 120 : -120;
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      $signature = '[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)] public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);';
      $SendMouseClick = Add-Type -memberDefinition $signature -name "Win32MouseEventNew" -namespace Win32Functions -passThru;
      for ($i = 0; $i -lt ${clicks}; $i++) {
        $SendMouseClick::mouse_event(0x0800, 0, 0, ${wheelDelta}, 0);
        Start-Sleep -Milliseconds 100;
      }
    `;
    await execAsync(`powershell -Command "${psScript}"`);
    return `Scrolled ${direction} ${clicks} times`;
  } catch (error) {
    throw new Error(`Error scrolling: ${error.message}`);
  }
}

/**
 * Send keyboard input
 * @param {string} text - Text to type
 * @returns {Promise<string>} Result message
 */
export async function typeText(text) {
  try {
    // Escape special characters for PowerShell
    const escapedText = text.replace(/'/g, "''").replace(/"/g, '""');
    
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      [System.Windows.Forms.SendKeys]::SendWait('${escapedText}');
    `;
    await execAsync(`powershell -Command "${psScript}"`);
    return `Typed: "${text}"`;
  } catch (error) {
    throw new Error(`Error typing text: ${error.message}`);
  }
}

/**
 * Send special key combinations
 * @param {string} keys - Key combination (e.g., 'ctrl+c', 'alt+tab', 'enter')
 * @returns {Promise<string>} Result message
 */
export async function sendKeys(keys) {
  try {
    // Convert common key names to SendKeys format
    const keyMap = {
      'ctrl+c': '^c',
      'ctrl+v': '^v',
      'ctrl+x': '^x',
      'ctrl+z': '^z',
      'ctrl+y': '^y',
      'ctrl+a': '^a',
      'ctrl+s': '^s',
      'alt+tab': '%{TAB}',
      'alt+f4': '%{F4}',
      'enter': '{ENTER}',
      'escape': '{ESC}',
      'tab': '{TAB}',
      'space': ' ',
      'backspace': '{BACKSPACE}',
      'delete': '{DELETE}',
      'home': '{HOME}',
      'end': '{END}',
      'pageup': '{PGUP}',
      'pagedown': '{PGDN}',
      'up': '{UP}',
      'down': '{DOWN}',
      'left': '{LEFT}',
      'right': '{RIGHT}',
      'f1': '{F1}',
      'f2': '{F2}',
      'f3': '{F3}',
      'f4': '{F4}',
      'f5': '{F5}',
      'windows': '^{ESC}'
    };
    
    const sendKeysFormat = keyMap[keys.toLowerCase()] || keys;
    
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      [System.Windows.Forms.SendKeys]::SendWait('${sendKeysFormat}');
    `;
    await execAsync(`powershell -Command "${psScript}"`);
    return `Sent keys: ${keys}`;
  } catch (error) {
    throw new Error(`Error sending keys: ${error.message}`);
  }
}

/**
 * Get screen resolution
 * @returns {Promise<{width: number, height: number}>} Screen dimensions
 */
export async function getScreenResolution() {
  try {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen;
      Write-Output "$($screen.Bounds.Width),$($screen.Bounds.Height)"
    `;
    const { stdout } = await execAsync(`powershell -Command "${psScript}"`);
    const [width, height] = stdout.trim().split(',').map(Number);
    return { width, height };
  } catch (error) {
    throw new Error(`Error getting screen resolution: ${error.message}`);
  }
}

/**
 * Available input control actions
 */
export const inputActions = {
  getMousePosition: {
    name: 'getMousePosition',
    description: 'Get current mouse cursor position',
    function: getMousePosition,
    requiresConfirmation: false
  },
  moveMouse: {
    name: 'moveMouse',
    description: 'Move mouse to specific coordinates',
    function: moveMouse,
    requiresConfirmation: true,
    parameters: ['x', 'y']
  },
  mouseClick: {
    name: 'mouseClick',
    description: 'Perform mouse click (left, right, double)',
    function: mouseClick,
    requiresConfirmation: true,
    parameters: ['button', 'x', 'y']
  },
  mouseScroll: {
    name: 'mouseScroll',
    description: 'Scroll mouse wheel up or down',
    function: mouseScroll,
    requiresConfirmation: true,
    parameters: ['direction', 'clicks']
  },
  typeText: {
    name: 'typeText',
    description: 'Type text at current cursor position',
    function: typeText,
    requiresConfirmation: true,
    parameters: ['text']
  },
  sendKeys: {
    name: 'sendKeys',
    description: 'Send keyboard shortcuts and special keys',
    function: sendKeys,
    requiresConfirmation: true,
    parameters: ['keys']
  },
  getScreenResolution: {
    name: 'getScreenResolution',
    description: 'Get screen resolution',
    function: getScreenResolution,
    requiresConfirmation: false
  }
};