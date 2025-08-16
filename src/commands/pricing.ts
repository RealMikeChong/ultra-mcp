import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { pricingService } from '../pricing';

export function createPricingCommands(program: Command): void {
  const pricing = program
    .command('pricing')
    .description('Manage LiteLLM pricing data cache');

  // Refresh cache command
  pricing
    .command('refresh')
    .description('Force refresh the pricing cache from LiteLLM')
    .action(async () => {
      const spinner = ora('Refreshing pricing cache...').start();
      
      try {
        await pricingService.refreshCache();
        spinner.succeed(chalk.green('Pricing cache refreshed successfully!'));
        
        const cacheInfo = await pricingService.getCacheInfo();
        console.log(chalk.cyan('\nCache Information:'));
        console.log(`  Status: ${cacheInfo.exists ? 'Active' : 'Not found'}`);
        if (cacheInfo.age !== undefined) {
          console.log(`  Age: ${cacheInfo.age} seconds`);
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to refresh pricing cache'));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  // Show pricing for a model
  pricing
    .command('show [model]')
    .description('Show pricing information for a model or all models')
    .option('-a, --all', 'Show all available models')
    .action(async (model: string | undefined, options: { all?: boolean }) => {
      try {
        if (options.all || !model) {
          // Show all models
          const spinner = ora('Loading pricing data...').start();
          const models = await pricingService.getAllModels();
          spinner.stop();

          if (models.length === 0) {
            console.log(chalk.yellow('No pricing data available'));
            return;
          }

          const table = new Table({
            head: [
              chalk.cyan('Model'),
              chalk.cyan('Input (per 1K)'),
              chalk.cyan('Output (per 1K)'),
              chalk.cyan('Input >200K'),
              chalk.cyan('Output >200K'),
            ],
            style: { head: [], border: [] },
          });

          for (const modelName of models.slice(0, 50)) { // Limit to first 50 models
            const pricing = await pricingService.getModelPricing(modelName);
            if (pricing) {
              table.push([
                modelName,
                pricingService.formatCost((pricing.input_cost_per_token ?? 0) * 1000),
                pricingService.formatCost((pricing.output_cost_per_token ?? 0) * 1000),
                pricing.input_cost_per_token_above_200k_tokens 
                  ? pricingService.formatCost(pricing.input_cost_per_token_above_200k_tokens * 1000)
                  : '-',
                pricing.output_cost_per_token_above_200k_tokens
                  ? pricingService.formatCost(pricing.output_cost_per_token_above_200k_tokens * 1000)
                  : '-',
              ]);
            }
          }

          console.log(chalk.cyan('\n📊 Model Pricing Information\n'));
          console.log(table.toString());
          
          if (models.length > 50) {
            console.log(chalk.gray(`\n... and ${models.length - 50} more models`));
          }
        } else {
          // Show specific model
          const pricing = await pricingService.getModelPricing(model);
          
          if (!pricing) {
            console.log(chalk.yellow(`No pricing information found for model: ${model}`));
            console.log(chalk.gray('Tip: Use "pricing show --all" to see available models'));
            return;
          }

          console.log(chalk.cyan(`\n📊 Pricing for ${model}\n`));
          console.log(`  Input cost:  ${pricingService.formatCost((pricing.input_cost_per_token ?? 0) * 1000)} per 1K tokens`);
          console.log(`  Output cost: ${pricingService.formatCost((pricing.output_cost_per_token ?? 0) * 1000)} per 1K tokens`);
          
          if (pricing.input_cost_per_token_above_200k_tokens) {
            console.log(chalk.gray('\n  Tiered Pricing (>200K tokens):'));
            console.log(`    Input:  ${pricingService.formatCost(pricing.input_cost_per_token_above_200k_tokens * 1000)} per 1K tokens`);
            console.log(`    Output: ${pricingService.formatCost(pricing.output_cost_per_token_above_200k_tokens! * 1000)} per 1K tokens`);
          }

          if (pricing.max_input_tokens || pricing.max_output_tokens) {
            console.log(chalk.gray('\n  Token Limits:'));
            if (pricing.max_input_tokens) {
              console.log(`    Max input:  ${pricing.max_input_tokens.toLocaleString()} tokens`);
            }
            if (pricing.max_output_tokens) {
              console.log(`    Max output: ${pricing.max_output_tokens.toLocaleString()} tokens`);
            }
          }

          // Calculate example costs
          console.log(chalk.gray('\n  Example Costs:'));
          const examples = [
            { input: 1000, output: 500 },
            { input: 10000, output: 2000 },
            { input: 100000, output: 10000 },
          ];

          for (const example of examples) {
            const cost = await pricingService.calculateCost(model, example.input, example.output);
            if (cost) {
              console.log(`    ${example.input.toLocaleString()} in / ${example.output.toLocaleString()} out: ${pricingService.formatCost(cost.totalCost)}`);
            }
          }
        }

        // Show cache info
        const cacheInfo = await pricingService.getCacheInfo();
        console.log(chalk.gray(`\nCache: ${cacheInfo.exists ? `Active (${cacheInfo.age}s old)` : 'Not found'}`));
        
      } catch (error) {
        console.error(chalk.red('Error:', error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  // Calculate cost
  pricing
    .command('calculate <model> <input> <output>')
    .description('Calculate cost for given token usage')
    .action(async (model: string, inputStr: string, outputStr: string) => {
      try {
        const inputTokens = parseInt(inputStr, 10);
        const outputTokens = parseInt(outputStr, 10);

        if (isNaN(inputTokens) || isNaN(outputTokens)) {
          console.error(chalk.red('Invalid token counts. Please provide numbers.'));
          process.exit(1);
        }

        const calculation = await pricingService.calculateCost(model, inputTokens, outputTokens);
        
        if (!calculation) {
          console.log(chalk.yellow(`No pricing information found for model: ${model}`));
          return;
        }

        console.log(chalk.cyan(`\n💰 Cost Calculation for ${model}\n`));
        console.log(`  Input:  ${inputTokens.toLocaleString()} tokens = ${pricingService.formatCost(calculation.inputCost)}`);
        console.log(`  Output: ${outputTokens.toLocaleString()} tokens = ${pricingService.formatCost(calculation.outputCost)}`);
        console.log(chalk.green(`  Total:  ${pricingService.formatCost(calculation.totalCost)}`));
        
        if (calculation.tieredPricingApplied) {
          console.log(chalk.gray('\n  Note: Tiered pricing applied for tokens above 200K'));
        }
      } catch (error) {
        console.error(chalk.red('Error:', error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  // Clear cache
  pricing
    .command('clear')
    .description('Clear the pricing cache')
    .action(async () => {
      try {
        await pricingService.clearCache();
        console.log(chalk.green('✅ Pricing cache cleared successfully'));
      } catch (error) {
        console.error(chalk.red('Error:', error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  // Cache info
  pricing
    .command('info')
    .description('Show pricing cache information')
    .action(async () => {
      try {
        const cacheInfo = await pricingService.getCacheInfo();
        
        console.log(chalk.cyan('\n📦 Pricing Cache Information\n'));
        console.log(`  Status: ${cacheInfo.exists ? chalk.green('Active') : chalk.yellow('Not found')}`);
        
        if (cacheInfo.exists) {
          console.log(`  Age: ${cacheInfo.age} seconds`);
          console.log(`  Expired: ${cacheInfo.expired ? chalk.yellow('Yes') : chalk.green('No')}`);
          
          if (cacheInfo.lastInMemoryFetch) {
            const inMemoryAge = Math.floor(cacheInfo.lastInMemoryFetch / 1000);
            console.log(`  In-memory cache: ${inMemoryAge}s old`);
          }
        }

        console.log(chalk.gray('\n  Cache TTL: 1 hour'));
        console.log(chalk.gray('  Source: https://github.com/BerriAI/litellm'));
        
      } catch (error) {
        console.error(chalk.red('Error:', error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}