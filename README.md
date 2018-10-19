# stanna
From the Swedish verb 'to halt'.  Halt your machine after sending notification and waiting specified time limit.  This capability becomes useful when using cloud resources like Amazon EC2 where you are charged each hour the compute instance is running, regardless if it is doing any computation.  So say you wrote a bash script to do some amazing deep learning training or downloaded a bunch of data to be processed later.  Stanna allows you to do something like this:

    ./do-awesome-stuff.sh && stanna "Awesome stuff done, $(hostname) shutting down."

Rather than having to setup email smarthost and all that 70's stuff.  You can create a channel in Slack, and then a [webhook in Slack](https://api.slack.com/incoming-webhooks).  So what happens in the above example is:

 1. ./do-awesome-stuff.sh does its thing.
 2. the '&&' says if and only if ./do-awesome-stuff.sh exits successfully run stanna
 3. stanna posts the message to Slack
 4. waits the configured timeout (just in case you want to login and `stanna abort` the shutdown)
 5. system is haulted.

A simple configuration looks like this:

    cat ~/.stanna.json | jq '.'
    {
      "waitTimeBeforeHalt": "500",
      "channel": "#deep-learning",
      "webhook": "https://hooks.slack.com/services/asdfasdfasdf/asdfasdfasdf"
    }

You can create this file yourself or simply run the wizard:

    stanna init

More features will show up in the future.
