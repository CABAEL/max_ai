import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { speak } from './tts.js';

const execAsync = promisify(exec);

/**
 * System actions that Max can perform with user confirmation
 */

/**
 * Get list of running processes
 * @returns {Promise<string>} Process list
 */
export async function getRunningProcesses() {
  try {
    const { stdout } = await execAsync('tasklist /fo csv | findstr /v "Image Name"');
    const processes = stdout.split('\n')
      .filter(line => line.trim())
      .slice(0, 10) // Limit to first 10 processes
      .map(line => {
        const parts = line.split(',');
        return `${parts[0]?.replace(/"/g, '')} (PID: ${parts[1]?.replace(/"/g, '')})`;
      })
      .join('\n');
    return `Top running processes:\n${processes}`;
  } catch (error) {
    return `Error getting processes: ${error.message}`;
  }
}

/**
 * Get current active window title
 * @returns {Promise<string>} Active window info
 */
export async function getActiveWindow() {
  try {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      $activeWindow = [System.Windows.Forms.Form]::ActiveForm;
      if ($activeWindow) { 
        $activeWindow.Text 
      } else { 
        "No active window detected" 
      }
    `;
    const { stdout } = await execAsync(`powershell -Command "${psScript}"`);
    return `Active window: ${stdout.trim()}`;
  } catch (error) {
    return `Error getting active window: ${error.message}`;
  }
}

/**
 * Run a program or command with user confirmation
 * @param {string} command - Command to execute
 * @param {Function} confirmCallback - Function to get user confirmation
 * @returns {Promise<string>} Execution result
 */
export async function runProgram(command, confirmCallback) {
  try {
    // Ask for confirmation
    await speak(`I want to run the command: ${command}. Should I proceed?`);
    console.log(`🔐 CONFIRMATION REQUIRED: Run command "${command}"?`);
    console.log('Say "yes" or "confirm" to proceed, "no" or "cancel" to abort.');

    const confirmed = await confirmCallback();

    if (!confirmed) {
      return 'Command execution cancelled by user.';
    }

    console.log(`⚡ Executing: ${command}`);
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

    let result = 'Command executed successfully.';
    if (stdout.trim()) result += `\nOutput: ${stdout.trim()}`;
    if (stderr.trim()) result += `\nWarnings: ${stderr.trim()}`;

    return result;
  } catch (error) {
    return `Error executing command: ${error.message}`;
  }
}

/**
 * Open an application by name
 * @param {string} appName - Application name or path
 * @param {Function} confirmCallback - Function to get user confirmation
 * @returns {Promise<string>} Result
 */
export async function openApplication(appName, confirmCallback) {
  try {
    // Common application mappings
    const appMappings = {
      'notepad': 'notepad.exe',
      'calculator': 'calc.exe',
      'paint': 'mspaint.exe',
      'chrome': 'chrome.exe',
      'firefox': 'firefox.exe',
      'edge': 'msedge.exe',
      'explorer': 'explorer.exe',
      'cmd': 'cmd.exe',
      'powershell': 'powershell.exe',
      'task manager': 'taskmgr.exe',
      'control panel': 'control.exe',
      'settings': 'ms-settings:',
      'word': 'winword.exe',
      'excel': 'excel.exe',
      'powerpoint': 'powerpnt.exe',
      'outlook': 'outlook.exe',
      'visual studio code': 'code.exe',
      'vscode': 'code.exe'
    };

    const normalizedName = appName.toLowerCase();
    const executable = appMappings[normalizedName] || appName;

    await speak(`I want to open ${appName}. Should I proceed?`);
    console.log(`🔐 CONFIRMATION REQUIRED: Open application "${appName}"?`);
    console.log('Say "yes" or "confirm" to proceed, "no" or "cancel" to abort.');

    const confirmed = await confirmCallback();

    if (!confirmed) {
      return 'Application launch cancelled by user.';
    }

    console.log(`🚀 Opening: ${appName}`);

    // Use start command to open applications
    const command = `start "" "${executable}"`;
    await execAsync(command);

    return `Successfully opened ${appName}.`;
  } catch (error) {
    return `Error opening application: ${error.message}`;
  }
}

/**
 * Shutdown the computer
 * @param {Function} confirmCallback - Function to get user confirmation
 * @returns {Promise<string>} Result
 */
export async function shutdownComputer(confirmCallback) {
  try {
    await speak('I want to shutdown the computer. This will close all programs and turn off the PC. Should I proceed?');
    console.log('🔐 CRITICAL CONFIRMATION REQUIRED: SHUTDOWN COMPUTER?');
    console.log('Say "yes shutdown" or "confirm shutdown" to proceed, anything else to abort.');

    const confirmed = await confirmCallback();

    if (!confirmed) {
      return 'Computer shutdown cancelled by user.';
    }

    console.log('💻 Initiating system shutdown...');
    await speak('Shutting down the computer now. Goodbye!');

    // Shutdown with 10 second delay to allow speech to complete
    await execAsync('shutdown /s /t 10 /c "Max AI Assistant initiated shutdown"');

    return 'Computer shutdown initiated. System will power off in 10 seconds.';
  } catch (error) {
    return `Error shutting down computer: ${error.message}`;
  }
}

/**
 * Restart the computer
 * @param {Function} confirmCallback - Function to get user confirmation
 * @returns {Promise<string>} Result
 */
export async function restartComputer(confirmCallback) {
  try {
    await speak('I want to restart the computer. This will close all programs and reboot the PC. Should I proceed?');
    console.log('🔐 CRITICAL CONFIRMATION REQUIRED: RESTART COMPUTER?');
    console.log('Say "yes restart" or "confirm restart" to proceed, anything else to abort.');

    const confirmed = await confirmCallback();

    if (!confirmed) {
      return 'Computer restart cancelled by user.';
    }

    console.log('🔄 Initiating system restart...');
    await speak('Restarting the computer now. See you after the reboot!');

    // Restart with 10 second delay to allow speech to complete
    await execAsync('shutdown /r /t 10 /c "Max AI Assistant initiated restart"');

    return 'Computer restart initiated. System will reboot in 10 seconds.';
  } catch (error) {
    return `Error restarting computer: ${error.message}`;
  }
}

/**
 * Run command with administrator privileges
 * @param {string} command - Command to execute with admin rights
 * @param {Function} confirmCallback - Function to get user confirmation
 * @returns {Promise<string>} Result
 */
export async function runAsAdmin(command, confirmCallback) {
  try {
    await speak(`I want to run this command with administrator privileges: ${command}. This requires elevated access. Should I proceed?`);
    console.log(`🔐 ADMIN CONFIRMATION REQUIRED: Run "${command}" as administrator?`);
    console.log('Say "yes admin" or "confirm admin" to proceed, anything else to abort.');

    const confirmed = await confirmCallback();

    if (!confirmed) {
      return 'Admin command execution cancelled by user.';
    }

    console.log(`⚡ Executing with admin rights: ${command}`);

    // Use PowerShell to run with elevated privileges
    const psCommand = `Start-Process powershell -ArgumentList '-Command', '${command}' -Verb RunAs -Wait`;
    await execAsync(`powershell -Command "${psCommand}"`);

    return `Command executed with administrator privileges: ${command}`;
  } catch (error) {
    return `Error executing admin command: ${error.message}`;
  }
}

/**
 * Lock the computer
 * @returns {Promise<string>} Result
 */
export async function lockComputer() {
  try {
    console.log('🔒 Locking computer...');
    await speak('Locking the computer now.');

    // Lock the workstation
    await execAsync('rundll32.exe user32.dll,LockWorkStation');

    return 'Computer locked successfully.';
  } catch (error) {
    return `Error locking computer: ${error.message}`;
  }
}

/**
 * Set speech password for unlocking
 * @param {string} password - Speech password to set
 * @param {Function} confirmCallback - Function to get user confirmation
 * @returns {Promise<string>} Result
 */
export async function setSpeechPassword(password, confirmCallback) {
  try {
    await speak(`I want to set your speech password to: ${password}. Should I proceed?`);
    console.log(`🔐 CONFIRMATION REQUIRED: Set speech password to "${password}"?`);
    console.log('Say "yes" or "confirm" to proceed, "no" or "cancel" to abort.');

    const confirmed = await confirmCallback();

    if (!confirmed) {
      return 'Speech password setup cancelled by user.';
    }

    // Store the password (in a real implementation, this should be encrypted)
    global.speechPassword = password.toLowerCase().trim();

    console.log('🔑 Speech password set successfully');
    return `Speech password set successfully. You can now unlock the computer by saying: "${password}"`;
  } catch (error) {
    return `Error setting speech password: ${error.message}`;
  }
}

/**
 * Verify speech password for unlocking
 * @param {string} spokenPassword - Password spoken by user
 * @returns {boolean} True if password matches
 */
export function verifySpeechPassword(spokenPassword) {
  if (!global.speechPassword) {
    console.log('❌ No speech password set');
    return false;
  }

  const normalizedSpoken = spokenPassword.toLowerCase().trim();
  const normalizedStored = global.speechPassword.toLowerCase().trim();

  // Allow for slight variations in speech recognition
  const similarity = calculateSimilarity(normalizedSpoken, normalizedStored);
  const isMatch = similarity > 0.8; // 80% similarity threshold

  console.log(`🔍 Password verification: "${normalizedSpoken}" vs "${normalizedStored}" (similarity: ${similarity.toFixed(2)})`);

  return isMatch;
}

/**
 * Calculate similarity between two strings (for speech recognition tolerance)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Attempt to unlock computer with speech password
 * @param {string} spokenPassword - Password spoken by user
 * @returns {Promise<string>} Result
 */
/**
 * Unlock Windows computer with PIN
 * @returns {Promise<string>} Result
 */
export async function unlockComputer() {
  try {
    console.log('🔓 Unlocking computer with PIN...');
    await speak('Unlocking computer now.');

    // Your Windows PIN
    const windowsPIN = '050121';

    // Method 1: Try using a more robust PowerShell approach
    try {
      console.log('🔑 Attempting to unlock with enhanced method...');

      // Create a comprehensive PowerShell script
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        
        # Wake up the screen with multiple key presses
        [System.Windows.Forms.SendKeys]::SendWait(' ')
        Start-Sleep -Milliseconds 500
        [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
        Start-Sleep -Milliseconds 1000
        [System.Windows.Forms.SendKeys]::SendWait(' ')
        Start-Sleep -Milliseconds 2000
        
        # Send PIN digits individually with proper delays
        Write-Host "Entering PIN..."
        foreach ($digit in '${windowsPIN}'.ToCharArray()) {
          [System.Windows.Forms.SendKeys]::SendWait($digit)
          Write-Host "Sent digit: $digit"
          Start-Sleep -Milliseconds 300
        }
        
        # Press Enter to submit
        Start-Sleep -Milliseconds 800
        [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
        Write-Host "PIN submission completed"
      `;

      await execAsync(`powershell -Command "${psScript.replace(/\n/g, '; ')}"`);
      console.log('✅ Enhanced unlock method completed');

    } catch (enhancedError) {
      console.log('⚠️ Enhanced method failed, trying basic approach...');

      // Method 2: Basic approach with individual commands
      // Wake screen
      await execAsync('powershell -Command "[System.Windows.Forms.SendKeys]::SendWait(\' \')"');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Press Escape to ensure we're on PIN screen
      await execAsync('powershell -Command "[System.Windows.Forms.SendKeys]::SendWait(\'{ESC}\')"');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wake again
      await execAsync('powershell -Command "[System.Windows.Forms.SendKeys]::SendWait(\' \')"');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send PIN digits one by one
      console.log('🔢 Entering PIN digits...');
      for (let i = 0; i < windowsPIN.length; i++) {
        const digit = windowsPIN[i];
        console.log(`Sending digit ${i + 1}: ${digit}`);
        await execAsync(`powershell -Command "[System.Windows.Forms.SendKeys]::SendWait('${digit}')"`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Press Enter
      await new Promise(resolve => setTimeout(resolve, 800));
      await execAsync('powershell -Command "[System.Windows.Forms.SendKeys]::SendWait(\'{ENTER}\')"');

      console.log('✅ Basic unlock method completed');
    }

    return 'Computer unlock sequence completed. PIN (050121) has been entered.';
  } catch (error) {
    console.error('Unlock error details:', error);
    return `Error unlocking computer: ${error.message}. The lock screen may need manual activation first.`;
  }
}

export async function unlockWithSpeechPassword(spokenPassword) {
  try {
    console.log(`🔓 Attempting to unlock with password: "${spokenPassword}"`);

    if (verifySpeechPassword(spokenPassword)) {
      console.log('✅ Speech password verified');
      await speak('Password verified. Welcome back!');

      // Use the PIN unlock function
      return await unlockComputer();
    } else {
      console.log('❌ Speech password verification failed');
      await speak('Incorrect password. Access denied.');
      return 'Incorrect speech password. Access denied.';
    }
  } catch (error) {
    return `Error unlocking computer: ${error.message}`;
  }
}

/**
 * Terminate a process by name or PID with confirmation
 * @param {string} processIdentifier - Process name or PID
 * @param {Function} confirmCallback - Function to get user confirmation
 * @returns {Promise<string>} Termination result
 */
export async function terminateProcess(processIdentifier, confirmCallback) {
  try {
    // Ask for confirmation
    await speak(`I want to terminate the process: ${processIdentifier}. Should I proceed?`);
    console.log(`🔐 CONFIRMATION REQUIRED: Terminate process "${processIdentifier}"?`);
    console.log('Say "yes" or "confirm" to proceed, "no" or "cancel" to abort.');

    const confirmed = await confirmCallback();

    if (!confirmed) {
      return 'Process termination cancelled by user.';
    }

    // Determine if it's a PID (number) or process name
    const isPID = /^\d+$/.test(processIdentifier);
    const command = isPID
      ? `taskkill /PID ${processIdentifier} /F`
      : `taskkill /IM ${processIdentifier} /F`;

    console.log(`⚡ Terminating: ${processIdentifier}`);
    const { stdout, stderr } = await execAsync(command);

    if (stderr && stderr.includes('not found')) {
      return `Process "${processIdentifier}" not found or already terminated.`;
    }

    return `Process "${processIdentifier}" terminated successfully.`;
  } catch (error) {
    return `Error terminating process: ${error.message}`;
  }
}

/**
 * Get system information
 * @returns {Promise<string>} System info
 */
export async function getSystemInfo() {
  try {
    const { stdout } = await execAsync('systeminfo | findstr /C:"OS Name" /C:"Total Physical Memory" /C:"System Up Time"');
    return `System Information:\n${stdout.trim()}`;
  } catch (error) {
    return `Error getting system info: ${error.message}`;
  }
}

/**
 * List files in a directory
 * @param {string} directory - Directory path (default: current)
 * @returns {Promise<string>} Directory listing
 */
export async function listDirectory(directory = '.') {
  try {
    const { stdout } = await execAsync(`dir "${directory}" /b`);
    const files = stdout.trim().split('\n').slice(0, 15); // Limit to 15 items
    return `Directory listing for ${directory}:\n${files.join('\n')}`;
  } catch (error) {
    return `Error listing directory: ${error.message}`;
  }
}

/**
 * Available system actions
 */
export const systemActions = {
  getRunningProcesses: {
    name: 'getRunningProcesses',
    description: 'List currently running processes',
    function: getRunningProcesses,
    requiresConfirmation: false
  },
  getActiveWindow: {
    name: 'getActiveWindow',
    description: 'Get current active window information',
    function: getActiveWindow,
    requiresConfirmation: false
  },
  runProgram: {
    name: 'runProgram',
    description: 'Run a program or command',
    function: runProgram,
    requiresConfirmation: true,
    parameters: ['command']
  },
  openApplication: {
    name: 'openApplication',
    description: 'Open an application by name',
    function: openApplication,
    requiresConfirmation: true,
    parameters: ['appName']
  },
  terminateProcess: {
    name: 'terminateProcess',
    description: 'Terminate a running process',
    function: terminateProcess,
    requiresConfirmation: true,
    parameters: ['processIdentifier']
  },
  shutdownComputer: {
    name: 'shutdownComputer',
    description: 'Shutdown the computer',
    function: shutdownComputer,
    requiresConfirmation: true,
    critical: true
  },
  restartComputer: {
    name: 'restartComputer',
    description: 'Restart the computer',
    function: restartComputer,
    requiresConfirmation: true,
    critical: true
  },
  runAsAdmin: {
    name: 'runAsAdmin',
    description: 'Run a command with administrator privileges',
    function: runAsAdmin,
    requiresConfirmation: true,
    parameters: ['command'],
    critical: true
  },
  lockComputer: {
    name: 'lockComputer',
    description: 'Lock the computer',
    function: lockComputer,
    requiresConfirmation: false
  },
  unlockComputer: {
    name: 'unlockComputer',
    description: 'Unlock computer with PIN',
    function: unlockComputer,
    requiresConfirmation: false
  },
  getSystemInfo: {
    name: 'getSystemInfo',
    description: 'Get system information',
    function: getSystemInfo,
    requiresConfirmation: false
  },
  listDirectory: {
    name: 'listDirectory',
    description: 'List files in a directory',
    function: listDirectory,
    requiresConfirmation: false,
    parameters: ['directory']
  }
};