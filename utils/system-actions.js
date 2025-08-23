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
    // Security check - block dangerous commands
    const dangerousCommands = ['format', 'del /s', 'rmdir /s', 'shutdown', 'restart', 'reg delete'];
    const isDangerous = dangerousCommands.some(dangerous => 
      command.toLowerCase().includes(dangerous.toLowerCase())
    );
    
    if (isDangerous) {
      return `Security block: Command "${command}" is potentially dangerous and cannot be executed.`;
    }
    
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
  terminateProcess: {
    name: 'terminateProcess',
    description: 'Terminate a running process',
    function: terminateProcess,
    requiresConfirmation: true,
    parameters: ['processIdentifier']
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