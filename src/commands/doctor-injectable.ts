import chalk from 'chalk';
import { ConfigManager } from '../config/manager';
import { ProviderManager } from '../providers/manager';

interface DoctorOptions {
  test?: boolean;
}

interface CheckResult {
  name: string;
  status: boolean;
  message: string;
}

interface DoctorDependencies {
  configManager?: ConfigManager;
  providerManager?: ProviderManager;
  // For testing: allow overriding console and process
  console?: Console;
  process?: NodeJS.Process;
  env?: NodeJS.ProcessEnv;
}

export async function runDoctorWithDeps(
  options: DoctorOptions = {},
  deps: DoctorDependencies = {}
): Promise<void> {
  const {
    configManager = new ConfigManager(),
    providerManager = new ProviderManager(configManager),
    console: customConsole = console,
    process: customProcess = process,
    env = process.env,
  } = deps;

  customConsole.log(chalk.bold('\n🏥 Ultra MCP Doctor\n'));
  customConsole.log('Checking your installation and configuration...\n');

  const results: CheckResult[] = [];

  // Check 1: Config file exists
  try {
    const config = await configManager.getConfig();
    results.push({
      name: 'Configuration file',
      status: true,
      message: `Found at ${await configManager.getConfigPath()}`,
    });

    // Check 2: OpenAI API Key
    const openaiKey = config.openai?.apiKey || env.OPENAI_API_KEY;
    if (openaiKey) {
      results.push({
        name: 'OpenAI API Key',
        status: true,
        message: openaiKey.startsWith('sk-') ? 'Valid format' : 'Set (custom format)',
      });
    } else {
      results.push({
        name: 'OpenAI API Key',
        status: false,
        message: 'Not configured',
      });
    }

    // Check 3: Google API Key
    const googleKey = config.google?.apiKey || env.GOOGLE_API_KEY;
    if (googleKey) {
      results.push({
        name: 'Google API Key',
        status: true,
        message: 'Configured',
      });
    } else {
      results.push({
        name: 'Google API Key',
        status: false,
        message: 'Not configured',
      });
    }

    // Check 4: Azure Configuration
    const azureKey = config.azure?.apiKey || env.AZURE_API_KEY;
    // Support both new AZURE_BASE_URL and legacy AZURE_ENDPOINT for backward compatibility
    const azureBaseURL = config.azure?.baseURL || env.AZURE_BASE_URL || env.AZURE_ENDPOINT;
    if (azureKey && azureBaseURL) {
      results.push({
        name: 'Azure OpenAI',
        status: true,
        message: 'API Key and baseURL configured',
      });
    } else if (azureKey || azureBaseURL) {
      results.push({
        name: 'Azure OpenAI',
        status: false,
        message: azureKey ? 'Missing baseURL' : 'Missing API key',
      });
    } else {
      results.push({
        name: 'Azure OpenAI',
        status: false,
        message: 'Not configured',
      });
    }

    // Check 5: xAI API Key
    const xaiKey = config.xai?.apiKey || env.XAI_API_KEY;
    if (xaiKey) {
      results.push({
        name: 'xAI API Key',
        status: true,
        message: 'Configured',
      });
    } else {
      results.push({
        name: 'xAI API Key',
        status: false,
        message: 'Not configured',
      });
    }

    // Check 6: At least one provider configured
    const hasAnyProvider = !!(openaiKey || googleKey || (azureKey && azureBaseURL) || xaiKey);
    results.push({
      name: 'Provider availability',
      status: hasAnyProvider,
      message: hasAnyProvider ? 'At least one provider configured' : 'No providers configured',
    });

    // Optional: Test connections
    if (options.test && hasAnyProvider) {
      customConsole.log(chalk.dim('\nTesting provider connections...\n'));
      
      const configuredProviders = await providerManager.getConfiguredProviders();

      for (const providerName of configuredProviders) {
        try {
          const provider = providerManager.getProvider(providerName);
          // Simple test - just check if we can create the provider
          const models = provider.listModels();
          results.push({
            name: `${providerName} connection`,
            status: true,
            message: `Provider initialized successfully (${models.length} models available)`,
          });
        } catch (error) {
          results.push({
            name: `${providerName} connection`,
            status: false,
            message: error instanceof Error ? error.message : 'Connection failed',
          });
        }
      }
    }

  } catch (error) {
    results.push({
      name: 'Configuration file',
      status: false,
      message: 'Not found or invalid',
    });
  }

  // Display results
  customConsole.log(chalk.bold('Check Results:\n'));
  
  let hasErrors = false;
  for (const result of results) {
    const icon = result.status ? chalk.green('✅') : chalk.red('❌');
    const name = result.status ? chalk.green(result.name) : chalk.red(result.name);
    customConsole.log(`${icon} ${name}: ${chalk.dim(result.message)}`);
    if (!result.status) hasErrors = true;
  }

  // Summary and recommendations
  customConsole.log('\n' + chalk.bold('Summary:'));
  
  if (!hasErrors) {
    customConsole.log(chalk.green('✨ Everything looks good! Your Ultra MCP installation is ready to use.'));
  } else {
    customConsole.log(chalk.yellow('⚠️  Some issues were found. Recommendations:\n'));
    
    if (!results.find(r => r.name === 'Configuration file')?.status) {
      customConsole.log(chalk.dim('  • Run "npx ultra-mcp config" to set up your configuration'));
    }
    
    const providerResults = results.filter(r =>
      ['OpenAI API Key', 'Google API Key', 'Azure OpenAI', 'xAI API Key'].includes(r.name)
    );
    
    if (providerResults.every(r => !r.status)) {
      customConsole.log(chalk.dim('  • Configure at least one AI provider to use Ultra MCP'));
      customConsole.log(chalk.dim('  • Set environment variables or run "npx ultra-mcp config"'));
    } else {
      const missingProviders = providerResults.filter(r => !r.status);
      if (missingProviders.length > 0) {
        customConsole.log(chalk.dim(`  • Optional: Configure additional providers for more options`));
      }
    }
  }

  customConsole.log('');
  
  // Exit with error code if critical issues
  if (!results.find(r => r.name === 'Provider availability')?.status) {
    customProcess.exit(1);
  }
}

// Maintain backward compatibility
export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  return runDoctorWithDeps(options);
}