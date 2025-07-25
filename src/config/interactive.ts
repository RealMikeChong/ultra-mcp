import prompts from 'prompts';
import chalk from 'chalk';
import { ConfigManager } from './manager';

export async function runInteractiveConfig(): Promise<void> {
  const configManager = new ConfigManager();
  const currentConfig = await configManager.getConfig();

  console.log(chalk.blue.bold('\n🛠️  Ultra MCP Configuration\n'));
  console.log(chalk.gray(`Config file location: ${await configManager.getConfigPath()}\n`));

  // Show current configuration status
  console.log(chalk.yellow('Current configuration:'));
  console.log(chalk.gray('- OpenAI API Key:'), currentConfig.openai?.apiKey ? chalk.green('✓ Set') : chalk.red('✗ Not set'));
  console.log(chalk.gray('- Google API Key:'), currentConfig.google?.apiKey ? chalk.green('✓ Set') : chalk.red('✗ Not set'));
  console.log(chalk.gray('- Azure API Key:'), currentConfig.azure?.apiKey ? chalk.green('✓ Set') : chalk.red('✗ Not set'));
  console.log(chalk.gray('- xAI API Key:'), currentConfig.xai?.apiKey ? chalk.green('✓ Set') : chalk.red('✗ Not set'));
  console.log();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: 'Configure API Keys', value: 'configure' },
        { title: 'View Current Configuration', value: 'view' },
        { title: 'Reset Configuration', value: 'reset' },
        { title: 'Exit', value: 'exit' },
      ],
    },
  ]);

  if (response.action === 'configure') {
    await configureApiKeys(configManager);
  } else if (response.action === 'view') {
    await viewConfiguration(configManager, chalk);
  } else if (response.action === 'reset') {
    await resetConfiguration(configManager, chalk);
  }
}

async function configureApiKeys(configManager: ConfigManager): Promise<void> {
  const currentConfig = await configManager.getConfig();

  console.log(chalk.blue('\n📝 Configure API Keys'));
  console.log(chalk.gray('Press Enter to keep the current value, or enter a new value.'));
  console.log(chalk.gray('Enter "clear" to remove an API key.\n'));

  // OpenAI API Key
  const openaiResponse = await prompts([
    {
      type: 'text',
      name: 'apiKey',
      message: 'OpenAI API Key:',
      initial: currentConfig.openai?.apiKey ? '(current value hidden)' : '',
    },
    {
      type: 'text',
      name: 'baseURL',
      message: 'OpenAI Base URL (optional, leave empty for default):',
      initial: currentConfig.openai?.baseURL || '',
    },
  ]);

  if (openaiResponse.apiKey && openaiResponse.apiKey !== '(current value hidden)') {
    if (openaiResponse.apiKey.toLowerCase() === 'clear') {
      await configManager.setApiKey('openai', undefined);
      console.log(chalk.yellow('OpenAI API Key cleared'));
    } else {
      await configManager.setApiKey('openai', openaiResponse.apiKey);
      console.log(chalk.green('OpenAI API Key updated'));
    }
  }

  if (openaiResponse.baseURL !== undefined && openaiResponse.baseURL !== currentConfig.openai?.baseURL) {
    await configManager.setBaseURL('openai', openaiResponse.baseURL || undefined);
    console.log(chalk.green('OpenAI Base URL updated'));
  }

  // Google API Key
  const googleResponse = await prompts([
    {
      type: 'text',
      name: 'apiKey',
      message: 'Google Gemini API Key:',
      initial: currentConfig.google?.apiKey ? '(current value hidden)' : '',
    },
    {
      type: 'text',
      name: 'baseURL',
      message: 'Google Base URL (optional, leave empty for default):',
      initial: currentConfig.google?.baseURL || '',
    },
  ]);

  if (googleResponse.apiKey && googleResponse.apiKey !== '(current value hidden)') {
    if (googleResponse.apiKey.toLowerCase() === 'clear') {
      await configManager.setApiKey('google', undefined);
      console.log(chalk.yellow('Google API Key cleared'));
    } else {
      await configManager.setApiKey('google', googleResponse.apiKey);
      console.log(chalk.green('Google API Key updated'));
    }
  }

  if (googleResponse.baseURL !== undefined && googleResponse.baseURL !== currentConfig.google?.baseURL) {
    await configManager.setBaseURL('google', googleResponse.baseURL || undefined);
    console.log(chalk.green('Google Base URL updated'));
  }

  // Azure configuration (optional)
  const azurePrompt = await prompts({
    type: 'confirm',
    name: 'configureAzure',
    message: 'Would you like to configure Azure AI?',
    initial: false,
  });

  if (azurePrompt.configureAzure) {
    const azureResponse = await prompts([
      {
        type: 'text',
        name: 'apiKey',
        message: 'Azure API Key:',
        initial: currentConfig.azure?.apiKey ? '(current value hidden)' : '',
      },
      {
        type: 'text',
        name: 'baseURL',
        message: 'Azure Base URL (optional):',
        initial: currentConfig.azure?.baseURL || '',
      },
    ]);

    if (azureResponse.apiKey && azureResponse.apiKey !== '(current value hidden)') {
      if (azureResponse.apiKey.toLowerCase() === 'clear') {
        await configManager.setApiKey('azure', undefined);
        console.log(chalk.yellow('Azure API Key cleared'));
      } else {
        await configManager.setApiKey('azure', azureResponse.apiKey);
        console.log(chalk.green('Azure API Key updated'));
      }
    }

    if (azureResponse.baseURL !== undefined && azureResponse.baseURL !== currentConfig.azure?.baseURL) {
      await configManager.setBaseURL('azure', azureResponse.baseURL || undefined);
      console.log(chalk.green('Azure Base URL updated'));
    }
  }

  // xAI API Key (optional)
  const xaiPrompt = await prompts({
    type: 'confirm',
    name: 'configureXai',
    message: 'Would you like to configure xAI Grok?',
    initial: false,
  });

  if (xaiPrompt.configureXai) {
    const xaiResponse = await prompts([
      {
        type: 'text',
        name: 'apiKey',
        message: 'xAI Grok API Key:',
        initial: currentConfig.xai?.apiKey ? '(current value hidden)' : '',
      },
      {
        type: 'text',
        name: 'baseURL',
        message: 'xAI Base URL (optional, leave empty for default):',
        initial: currentConfig.xai?.baseURL || '',
      },
    ]);

    if (xaiResponse.apiKey && xaiResponse.apiKey !== '(current value hidden)') {
      if (xaiResponse.apiKey.toLowerCase() === 'clear') {
        await configManager.setApiKey('xai', undefined);
        console.log(chalk.yellow('xAI API Key cleared'));
      } else {
        await configManager.setApiKey('xai', xaiResponse.apiKey);
        console.log(chalk.green('xAI API Key updated'));
      }
    }

    if (xaiResponse.baseURL !== undefined && xaiResponse.baseURL !== currentConfig.xai?.baseURL) {
      await configManager.setBaseURL('xai', xaiResponse.baseURL || undefined);
      console.log(chalk.green('xAI Base URL updated'));
    }
  }

  console.log(chalk.green('\n✅ Configuration updated successfully!'));
  
  // Run the main menu again
  await runInteractiveConfig();
}

async function viewConfiguration(configManager: ConfigManager, chalk: any): Promise<void> {
  const config = await configManager.getConfig();
  
  console.log(chalk.blue('\n📋 Current Configuration\n'));
  
  console.log(chalk.bold('OpenAI:'));
  console.log(chalk.gray('  API Key:'), config.openai?.apiKey ? chalk.green(maskApiKey(config.openai.apiKey)) : chalk.red('Not set'));
  console.log(chalk.gray('  Base URL:'), config.openai?.baseURL || chalk.gray('Default'));

  console.log(chalk.bold('\nGoogle:'));
  console.log(chalk.gray('  API Key:'), config.google?.apiKey ? chalk.green(maskApiKey(config.google.apiKey)) : chalk.red('Not set'));
  console.log(chalk.gray('  Base URL:'), config.google?.baseURL || chalk.gray('Default'));

  console.log(chalk.bold('\nAzure:'));
  console.log(chalk.gray('  API Key:'), config.azure?.apiKey ? chalk.green(maskApiKey(config.azure.apiKey)) : chalk.red('Not set'));
  console.log(chalk.gray('  Base URL:'), config.azure?.baseURL || chalk.red('Not set'));

  console.log(chalk.bold('\nxAI:'));
  console.log(chalk.gray('  API Key:'), config.xai?.apiKey ? chalk.green(maskApiKey(config.xai.apiKey)) : chalk.red('Not set'));
  console.log(chalk.gray('  Base URL:'), config.xai?.baseURL || chalk.gray('Default'));
  
  console.log(chalk.gray(`\nConfig file: ${await configManager.getConfigPath()}`));
  
  await prompts({
    type: 'text',
    name: 'continue',
    message: 'Press Enter to continue...',
  });
  
  await runInteractiveConfig();
}

async function resetConfiguration(configManager: ConfigManager, chalk: any): Promise<void> {
  const confirmResponse = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Are you sure you want to reset all configuration? This cannot be undone.',
    initial: false,
  });

  if (confirmResponse.confirm) {
    await configManager.reset();
    console.log(chalk.green('\n✅ Configuration reset successfully!'));
  } else {
    console.log(chalk.yellow('\n❌ Reset cancelled.'));
  }
  
  await runInteractiveConfig();
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '****';
  }
  return apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
}