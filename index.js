#!/usr/bin/env node

const neodoc = require('neodoc')
const sleep = require('system-sleep');
const chalk = require('chalk')
const Slack = require('slack-node')
const fs = require('fs')
const jsonfile = require('jsonfile')
const readline = require('readline')
const os = require('os')
require('shelljs/global')

/*
 * Program arguments
 */
const usage = `
Usage:
  stanna --help
  stanna init
  stanna abort
  stanna [--test] <message>
Example, try:
  stanna "Just finished what you asked me todo, shutting myself down --computer"
Options:
  -h, --help    Show this screen.
  --version     Show version.
  --test        Use to send slack message but not actually shutdown the machine
  <message>     A double quoted message that will be sent to slack along with annotations
`
const args = neodoc.run(usage)
configPath = getUserHome() + '/.stanna.json'


// Check for configuration -----------------------------------------------------------
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']
}


// Shutdown procedure -----------------------------------------------------------
function stanna(config, slack, args) {

  if (!args['<message>']) {
    console.log(chalk.red("Message not provided...exiting"))
    console.log(usage)
    exit(1)
  }

  let message = args['<message>']
  let fields = [
    {
      title: 'Hostname',
      value: os.hostname(),
      short: true
    },{
      title: 'Timeout',
      value: config.waitTimeBeforeHalt + ' seconds',
      short: true
    },{
      title: 'Exit Status',
      value: exec('echo $?', {silent:true}).stdout,
      color: '#f45642',
      short: true
    }
  ]

  if (args['--test']) {
    fields.push({
      title: 'Testing',
      value: 'enabled',
      color: '#f4e842',
      short: true
    })
  }

  // 1. Post to slack
  slack.webhook({
    channel: config.channel,
    username: 'Stanna',
    text: message,
    attachments: [{
      fields: fields,
    }],
    icon_emoji: ':hand:'
  }, function(err, response) {
    if (err || !response || response.statusCode > 300) {
      console.log(chalk.red('Unable to post message to slack', err, JSON.stringify(response)))
      exit(1)
    }

    console.log(chalk.green('Sent message to Slack'))

    if (args['--test']) {
      console.log(chalk.yellow('Exiting because this was a test'))
      exit(0)
    }

    // 2. Wait specified time
    console.log(chalk.green('Waiting ' + config.waitTimeBeforeHalt + ' seconds before system halt'))
    sleep(parseInt(config.waitTimeBeforeHalt) * 1000)

    // 3. Shutdown system
    console.log(chalk.yellow('Initiating shutdown'))
    if (exec('sudo shutdown -h now', {silent:true}).code !== 0) {
      console.log(chalk.red('ERROR Shutdown command failed'))
      exit(1)
    }

  })

}


// Wizard -------------------------------------------------------------------------
function wizard(configPath) {

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
}


if (!fs.existsSync(configPath) || args['init']) {

  // So no configuration
  if (!args['init']) {
    console.log(chalk.yellow('No configuration found at: ', configPath))
  }
  wizard(configPath)

} else {

  // Read configuration from file
  jsonfile.readFile(configPath, function(err, config) {

    if (err) {
      console.log(chalk.red("Unable to read configuration from:", file))
      console.log('Try running \'stanna init\'')
      exit(1)
    }

    if (args['abort']) {

      // Abort
      console.log(chalk.green('Aborting shutdown'))
      if (exec("pkill -o -e -SIGINT -f stanna").code !== 0) {
        console.log(chalk.red('ERROR could not abort'))
        exit(1)
      }

    } else {
    
      // Setup slack
      slack = new Slack()
      slack.setWebhook(config.webhook)
      
      // Enable Abort
      process.on('SIGINT', function() {
          console.log("Caught interrupt signal");

          slack.webhook({
            channel: config.channel,
            username: 'Stanna',
            text: "*Shutdown Aborted*",
            icon_emoji: ':hand:'
          }, function(err, response) {
            if (err || !response || response.statusCode > 300) {
              console.log(chalk.red('Unable to post abort message to slack', err, JSON.stringify(response)))
              exit(1)
            }

            process.exit();
          })
      });

      // Shutdown
      stanna(config, slack, args)
      
    }
  })

}
