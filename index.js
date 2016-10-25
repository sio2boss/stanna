#!/usr/bin/env node

const neodoc = require('neodoc')
const sleep = require('sleep')
const chalk = require('chalk')
const Slack = require('slack-node')
const fs = require('fs')
const jsonfile = require('jsonfile')
const readline = require('readline')
require('shelljs/global')


/*
 * Program arguments
 */
const args = neodoc.run(`
Usage:
  stanna --help
  stanna init
  stanna [--test] <message>
Example, try:
  stanna "Just finished what you asked me todo, shutting myself down --computer"
Options:
  -h, --help
`)

// check for configuration
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']
}

configPath = getUserHome() + '/.stanna.json'
if (!fs.existsSync(configPath) || args['init']) {

  // So no configuration
  console.log(chalk.yellow('No configuration found at: ', configPath))

  // Start wizard
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  console.log()
  console.log(chalk.bold('Setup Wizard'))
  config = {}
  rl.question('How long would you like to delay the shutdown in seconds: ', (answer) => {

    // Timeout
    console.log(chalk.gray('Setting delay to', answer, 'seconds'))
    config.waitTimeBeforeHalt = answer

    rl.question('What channel would you like to post messages to: ', (channel) => {

      // Channel
      console.log(chalk.gray('Setting channel to', channel))
      config.channel = channel

      rl.question('Need a slack webhook URI: ', (webhook) => {

        // Webhook
        console.log(chalk.gray('Setting webhook to', webhook))
        config.webhook = webhook
        rl.close()

        // Save to disk and exit
        console.log('Writing configuration settings to: ', configPath)
        fs.open(configPath, 'w+', function(err, f) {
          if (err) {
              console.log("ERROR !! " + err)
              exit(1)
          }

          fs.writeFile(f, JSON.stringify(config), function(err) {
            if(err) {
              console.log(err)
              exit(1)
            }

            exit(0)

          })

        })

      })

    })

  })

} else {

  // Read configuration from file
  jsonfile.readFile(configPath, function(err, config) {
    if (err) {
      console.log(chalk.red("Unable to read configuration from:", file))
      console.log('Try running \'stanna init\'')
      exit(1)
    }

    slack = new Slack()
    slack.setWebhook(config.webhook)

    // 1. Post to slack
    slack.webhook({
      channel: config.channel,
      username: 'webhookbot',
      text: args['<message>'],
      icon_emoji: ':ghost:'
    }, function(err, response) {
      if (err || !response || response.statusCode > 300) {
        console.log(chalk.red('Unable to post message to slack', err, response))
        exit(1)
      }

      console.log(chalk.green('Sent message to Slack'))

      // 2. Wait specified time
      console.log(chalk.green('Waiting ' + config.waitTimeBeforeHalt + ' seconds before system halt'))
      sleep.sleep(parseInt(config.waitTimeBeforeHalt))

      // 3. Shutdown system
      console.log(chalk.green('Initiating shutdown'))
      if (exec('echo "sudo shutdown -h now"').code !== 0) {
        console.log(chalk.red('ERROR Shutdown command failed'))
        exit(1)
      }

    })

  })

}
