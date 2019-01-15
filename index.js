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
  stanna [--test]
Example, try:
  stanna "Just finished what you asked me todo, shutting myself down --computer"
Options:
  -h, --help    Show this screen.
  --version     Show version.
  --test        Use to send slack message but not actually shutdown the machine
`
const args = neodoc.run(usage)
configPath = getUserHome() + '/.stanna.json'

// Messages
var messages = [
  "Yo! Your app is done doing what it was doing.",
  "All wrapped up, just going to shutdown.",
  "What do know? Your process completed, congrats!",
  "It ain't your birthday but goin' to blow out these candles.",
  "What the problem is?",
  "Can't see it from my house.",
  "Brainbox here: Requesting R&R.",
  "Don't care, I'm getting some rest.",
  "Let's blow this popstand.",
  "Ding dong, it's King Kong smashing the gong!",
  "Good night and good luck.",
  "Ring a ding ding, check on this thing.",
  "My app goes to yoga. Your app ... fruit rollup.",
  "Who you gonna call?!",
  "Stay classy San Diego.",
  "Catch you on the rebound.",
  "Catch you on the flip side.",
  "It has been emotional, bye now.",
  "Nice job breaking it, hero.",
  "Yesterday I saw a deer.",
  "Congratulations, the test is now over.",
  "So. How are you holding up?",
  "You look great, by the way. Very healthy.",
  "This next test involves turrets.",
  "Look, metal ball, I CAN hear you.",
  "Let’s see what the next test is.",
  "I've seen you in blue, I've seen you in yellow, but only you red will do for this fellow.",
  "You are the fruit to my loom.",
  "Red solo cup. I fill you up. Let's have a party!",
  "Red solo cup. I lift you up. Proceed to party!",
  "Yeah........I'm gonna need you to come in on Saturday.",
  "I'm gonna have to disagree with you there.",
  "Excuse me, but I think you have my stapler.",
  "Didn't you get the memo?",
  "I could set the building on fire.",
  "I'm not going to do anything illegal.",
  "It's not that I'm lazy, I just don't care.",
  "He who controls the battlefield, controls history.",
  "I’m no hero. Never was, never will be.",
  "I don't have any more tears to shed.",
  "I've never fought for anyone but myself.",
  "A name means nothing on the battlefield.",
  "We are already pulled over!",
  "Can't pull over any farther!",
  "I sure as heckfire remember you!",
  "OK, campers, rise and shine, and don't forget your booties cause it's cold out there!",
  "Don't mess with me, pork chop.",
  "Did he actually refer to himself as 'the talent'?",
  "You can't go. All the plants are gonna die.",
  "Have that removed.",
  "Do you think I'm officer material?",
  "I'm worried about you.",
  "We've got each other.",
  "I don't think I've ever been this happy.",
  "That's a fact, Jack.",
  "You still have your health.",
  "You could join a monastery.",
  "Well sir, we were going to this bingo parlor at the YMCA...",
  "And then depression set in.",
  "Something like 8% of kids do it, but whatever.",
  "Chop chop, lollipop!",
  "Once more unto the breach, dear friends!",
  "Peace out, girl scout!"
]

function getRandomMessage() {
  return messages[Math.floor(Math.random()*messages.length)]
}

// Check for configuration -----------------------------------------------------------
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']
}


// Shutdown procedure -----------------------------------------------------------
function stanna(config, slack, args) {

  var message = '<' + config.user + '> ' + getRandomMessage()
  var fields = [
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
  rl.question('What is your slack handle? (e.g. @awesome1): ', (answer) => {

    // User
    if (answer.length > 1 && answer[0] !== '@') {
      answer = '@' + answer
    }
    console.log(chalk.gray('Setting username to', answer))
    config.user = answer

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
