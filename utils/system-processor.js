import { systemActions } from './system-actions.js';
import { inputActions } from './input-control.js';
import { recordChunk } from './record.js';
import { transcribe } from './stt.js';
import { speak } from './tts.js';

/**
 * Process system commands and handle confirmations
 * @param {string} message - User's message
 * @returns {Promise<string>} Enhanced message with system action results
 */
export async function processSystemCommands(message) {
  const lowerMessage = message.toLowerCase();
  let systemResults = [];

  // Check for process-related commands
  if (lowerMessage.includes('running processes') || lowerMessage.includes('list processes') ||
    lowerMessage.includes('what processes') || lowerMessage.includes('show processes')) {
    const result = await systemActions.getRunningProcesses.function();
    systemResults.push(result);
  }

  // Check for active window commands
  if (lowerMessage.includes('active window') || lowerMessage.includes('current window') ||
    lowerMessage.includes('what window') || lowerMessage.includes('screen')) {
    const result = await systemActions.getActiveWindow.function();
    systemResults.push(result);
  }

  // Check for system info commands
  if (lowerMessage.includes('system info') || lowerMessage.includes('computer info') ||
    lowerMessage.includes('system details') || lowerMessage.includes('pc info')) {
    const result = await systemActions.getSystemInfo.function();
    systemResults.push(result);
  }

  // Check for directory listing commands
  if (lowerMessage.includes('list files') || lowerMessage.includes('show files') ||
    lowerMessage.includes('directory') || lowerMessage.includes('folder contents')) {
    const directoryMatch = message.match(/(?:in|from|of)\s+([^\s]+)/i);
    const directory = directoryMatch ? directoryMatch[1] : '.';
    const result = await systemActions.listDirectory.function(directory);
    systemResults.push(result);
  }

  // Check for open application commands (specific apps)
  if (lowerMessage.includes('open ') || lowerMessage.includes('launch ') ||
    lowerMessage.includes('start ')) {
    const appMatch = message.match(/(?:open|launch|start)\s+(.+)/i);
    if (appMatch) {
      const appName = appMatch[1].trim();
      
      // Check if it's a common application
      const commonApps = ['notepad', 'calculator', 'paint', 'chrome', 'firefox', 'edge', 
                         'explorer', 'cmd', 'powershell', 'task manager', 'control panel', 
                         'settings', 'word', 'excel', 'powerpoint', 'outlook', 'visual studio code', 'vscode'];
      
      if (commonApps.some(app => appName.toLowerCase().includes(app))) {
        const result = await systemActions.openApplication.function(appName, getUserConfirmation);
        systemResults.push(result);
      } else {
        // Treat as general command
        const result = await systemActions.runProgram.function(appName, getUserConfirmation);
        systemResults.push(result);
      }
    }
  }

  // Check for run program commands (general commands)
  if (lowerMessage.includes('run ') || lowerMessage.includes('execute ')) {
    const commandMatch = message.match(/(?:run|execute)\s+(.+)/i);
    if (commandMatch) {
      const command = commandMatch[1].trim();
      const result = await systemActions.runProgram.function(command, getUserConfirmation);
      systemResults.push(result);
    }
  }

  // Check for terminate process commands
  if (lowerMessage.includes('kill ') || lowerMessage.includes('terminate ') ||
    lowerMessage.includes('stop ') || lowerMessage.includes('end process')) {
    const processMatch = message.match(/(?:kill|terminate|stop|end process)\s+(.+)/i);
    if (processMatch) {
      const processId = processMatch[1].trim();
      const result = await systemActions.terminateProcess.function(processId, getUserConfirmation);
      systemResults.push(result);
    }
  }

  // Check for shutdown commands
  if (lowerMessage.includes('shutdown') || lowerMessage.includes('shut down') ||
    lowerMessage.includes('turn off') || lowerMessage.includes('power off')) {
    const result = await systemActions.shutdownComputer.function(getAdminConfirmation);
    systemResults.push(result);
  }

  // Check for restart commands
  if (lowerMessage.includes('restart') || lowerMessage.includes('reboot') ||
    lowerMessage.includes('reset computer') || lowerMessage.includes('restart pc')) {
    const result = await systemActions.restartComputer.function(getAdminConfirmation);
    systemResults.push(result);
  }

  // Check for admin commands
  if (lowerMessage.includes('run as admin') || lowerMessage.includes('administrator') ||
    lowerMessage.includes('elevated') || lowerMessage.includes('admin rights')) {
    const commandMatch = message.match(/(?:run as admin|administrator|elevated|admin rights)\s+(.+)/i);
    if (commandMatch) {
      const command = commandMatch[1].trim();
      const result = await systemActions.runAsAdmin.function(command, getAdminConfirmation);
      systemResults.push(result);
    }
  }

  // Check for lock computer commands
  if (lowerMessage.includes('lock computer') || lowerMessage.includes('lock pc') ||
    lowerMessage.includes('lock screen') || lowerMessage.includes('lock workstation')) {
    const result = await systemActions.lockComputer.function();
    systemResults.push(result);
  }



  // Check for unlock commands
  if (lowerMessage.includes('unlock pc') || lowerMessage.includes('unlock computer') ||
      lowerMessage.includes('unlock') || lowerMessage.includes('open computer')) {
    // Direct unlock with PIN
    const result = await systemActions.unlockComputer.function();
    systemResults.push(result);
  }

  // Check for mouse position commands
  if (lowerMessage.includes('mouse position') || lowerMessage.includes('cursor position') ||
    lowerMessage.includes('where is mouse') || lowerMessage.includes('mouse location')) {
    const result = await inputActions.getMousePosition.function();
    systemResults.push(`Mouse position: ${result.x}, ${result.y}`);
  }

  // Check for screen resolution commands
  if (lowerMessage.includes('screen resolution') || lowerMessage.includes('screen size') ||
    lowerMessage.includes('display resolution') || lowerMessage.includes('monitor size')) {
    const result = await inputActions.getScreenResolution.function();
    systemResults.push(`Screen resolution: ${result.width} x ${result.height}`);
  }

  // Check for mouse movement commands
  if (lowerMessage.includes('move mouse') || lowerMessage.includes('move cursor')) {
    const coordMatch = message.match(/(?:move mouse|move cursor).*?(\d+).*?(\d+)/i);
    if (coordMatch) {
      const x = parseInt(coordMatch[1]);
      const y = parseInt(coordMatch[2]);
      const confirmed = await getUserConfirmation(`move mouse to ${x}, ${y}`);
      if (confirmed) {
        const result = await inputActions.moveMouse.function(x, y);
        systemResults.push(result);
      } else {
        systemResults.push('Mouse movement cancelled by user.');
      }
    }
  }

  // Check for mouse click commands
  if (lowerMessage.includes('click') || lowerMessage.includes('mouse click')) {
    let button = 'left';
    let x = null, y = null;

    if (lowerMessage.includes('right click')) button = 'right';
    if (lowerMessage.includes('double click')) button = 'double';

    const coordMatch = message.match(/(?:click|mouse click).*?(\d+).*?(\d+)/i);
    if (coordMatch) {
      x = parseInt(coordMatch[1]);
      y = parseInt(coordMatch[2]);
    }

    const position = x !== null && y !== null ? ` at ${x}, ${y}` : '';
    const confirmed = await getUserConfirmation(`perform ${button} click${position}`);
    if (confirmed) {
      const result = await inputActions.mouseClick.function(button, x, y);
      systemResults.push(result);
    } else {
      systemResults.push('Mouse click cancelled by user.');
    }
  }

  // Check for scroll commands
  if (lowerMessage.includes('scroll')) {
    const direction = lowerMessage.includes('scroll up') ? 'up' : 'down';
    const clicksMatch = message.match(/scroll.*?(\d+)/i);
    const clicks = clicksMatch ? parseInt(clicksMatch[1]) : 3;

    const confirmed = await getUserConfirmation(`scroll ${direction} ${clicks} times`);
    if (confirmed) {
      const result = await inputActions.mouseScroll.function(direction, clicks);
      systemResults.push(result);
    } else {
      systemResults.push('Scroll action cancelled by user.');
    }
  }

  // Check for typing commands
  if (lowerMessage.includes('type ') || lowerMessage.includes('write ')) {
    const textMatch = message.match(/(?:type|write)\s+(.+)/i);
    if (textMatch) {
      const text = textMatch[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      const confirmed = await getUserConfirmation(`type "${text}"`);
      if (confirmed) {
        const result = await inputActions.typeText.function(text);
        systemResults.push(result);
      } else {
        systemResults.push('Text typing cancelled by user.');
      }
    }
  }

  // Check for keyboard shortcut commands
  if (lowerMessage.includes('press ') || lowerMessage.includes('send keys') ||
    lowerMessage.includes('keyboard shortcut')) {
    const keyMatch = message.match(/(?:press|send keys|keyboard shortcut)\s+(.+)/i);
    if (keyMatch) {
      const keys = keyMatch[1].trim().toLowerCase();
      const confirmed = await getUserConfirmation(`send keys "${keys}"`);
      if (confirmed) {
        const result = await inputActions.sendKeys.function(keys);
        systemResults.push(result);
      } else {
        systemResults.push('Keyboard action cancelled by user.');
      }
    }
  }

  // Return enhanced message
  if (systemResults.length > 0) {
    return `User request: ${message}\n\nSystem action results:\n${systemResults.join('\n\n')}\n\nPlease provide a helpful response based on this information.`;
  }

  return message;
}

/**
 * Get user confirmation for dangerous operations
 * @param {string} action - Description of the action to confirm
 * @returns {Promise<boolean>} User confirmation
 */
async function getUserConfirmation(action = 'perform this action') {
  try {
    // Speak the confirmation request
    await speak(`I want to ${action}. Should I proceed?`);
    console.log(`🔐 CONFIRMATION REQUIRED: ${action}?`);
    console.log('Say "yes" or "confirm" to proceed, "no" or "cancel" to abort.');

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      // Record user response
      const filePath = await recordChunk('audio/confirmation.wav', 4000); // 4s for confirmation
      const response = await transcribe(filePath);

      if (response.trim()) {
        console.log(`🎤 You said: "${response.trim()}"`);

        const lowerResponse = response.toLowerCase();

        // Check for positive confirmation
        if (lowerResponse.includes('yes') || lowerResponse.includes('confirm') ||
          lowerResponse.includes('proceed') || lowerResponse.includes('do it') ||
          lowerResponse.includes('go ahead') || lowerResponse.includes('okay')) {
          console.log('✅ Confirmed by user');
          return true;
        }

        // Check for negative confirmation
        if (lowerResponse.includes('no') || lowerResponse.includes('cancel') ||
          lowerResponse.includes('abort') || lowerResponse.includes('stop') ||
          lowerResponse.includes('don\'t') || lowerResponse.includes('never mind')) {
          console.log('❌ Cancelled by user');
          return false;
        }

        // Unclear response
        console.log('❓ Unclear response. Please say "yes" to confirm or "no" to cancel.');
        attempts++;
      } else {
        console.log('❓ No response heard. Please say "yes" to confirm or "no" to cancel.');
        attempts++;
      }
    }

    console.log('⏰ No clear confirmation received. Cancelling for safety.');
    return false;
  } catch (error) {
    console.error('Error getting confirmation:', error);
    return false;
  }
}

/**
 * Get admin confirmation for critical operations (shutdown, restart, admin commands)
 * @param {string} action - Description of the action to confirm
 * @returns {Promise<boolean>} User confirmation
 */
async function getAdminConfirmation(action = 'perform this critical action') {
  try {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      // Record user response
      const filePath = await recordChunk('audio/admin-confirmation.wav', 5000); // 5s for critical confirmation
      const response = await transcribe(filePath);

      if (response.trim()) {
        console.log(`🎤 You said: "${response.trim()}"`);

        const lowerResponse = response.toLowerCase();

        // For shutdown - require specific confirmation
        if (action.includes('shutdown')) {
          if (lowerResponse.includes('yes shutdown') || lowerResponse.includes('confirm shutdown')) {
            console.log('✅ Shutdown confirmed by user');
            return true;
          }
        }
        
        // For restart - require specific confirmation
        if (action.includes('restart')) {
          if (lowerResponse.includes('yes restart') || lowerResponse.includes('confirm restart')) {
            console.log('✅ Restart confirmed by user');
            return true;
          }
        }
        
        // For admin commands - require specific confirmation
        if (action.includes('admin')) {
          if (lowerResponse.includes('yes admin') || lowerResponse.includes('confirm admin')) {
            console.log('✅ Admin command confirmed by user');
            return true;
          }
        }

        // Check for negative confirmation
        if (lowerResponse.includes('no') || lowerResponse.includes('cancel') ||
          lowerResponse.includes('abort') || lowerResponse.includes('stop') ||
          lowerResponse.includes('don\'t') || lowerResponse.includes('never mind')) {
          console.log('❌ Cancelled by user');
          return false;
        }

        // Unclear response for critical actions
        console.log('❓ For critical actions, please be specific. Say the exact confirmation phrase.');
        attempts++;
      } else {
        console.log('❓ No response heard. Please provide clear confirmation.');
        attempts++;
      }
    }

    console.log('⏰ No clear confirmation received. Cancelling critical operation for safety.');
    return false;
  } catch (error) {
    console.error('Error getting admin confirmation:', error);
    return false;
  }
}

/**
 * Check if message contains system commands
 * @param {string} message - User's message
 * @returns {boolean} True if system commands detected
 */
export function containsSystemCommands(message) {
  const systemKeywords = [
    'run ', 'execute ', 'start ', 'launch ', 'open ',
    'kill ', 'terminate ', 'stop ', 'end process',
    'running processes', 'list processes', 'show processes',
    'active window', 'current window', 'screen',
    'system info', 'computer info', 'pc info',
    'list files', 'show files', 'directory', 'folder contents',
    'mouse position', 'cursor position', 'mouse location',
    'screen resolution', 'screen size', 'display resolution',
    'move mouse', 'move cursor', 'click', 'mouse click',
    'scroll', 'type ', 'write ', 'press ', 'send keys', 'keyboard shortcut',
    'shutdown', 'shut down', 'turn off', 'power off',
    'restart', 'reboot', 'reset computer',
    'run as admin', 'administrator', 'elevated', 'admin rights',
    'lock computer', 'lock pc', 'lock screen', 'lock workstation',
    'unlock', 'unlock pc', 'unlock computer', 'open computer'
  ];

  const lowerMessage = message.toLowerCase();
  return systemKeywords.some(keyword => lowerMessage.includes(keyword));
}