import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji } from './utils.js';
import { WebSocketManager, WebSocketShardEvents, CompressionMethod } from '@discordjs/ws';
import { REST } from '@discordjs/rest';
import { Client } from 'discord.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

let eventToNameMap = {};

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
// This example will spawn Discord's recommended shard count, all under the current process.
const manager = new WebSocketManager({
  token: process.env.DISCORD_TOKEN,
  intents: 65536, // for no intents
  rest,
});
const client = new Client({ intents: 1 << 0 });

client.login(process.env.DISCORD_TOKEN);

manager.on(WebSocketShardEvents.Dispatch, (event) => {
  console.log(event);
  if (event?.d?.guild_id) {
    let guild = client.guilds.cache.get(event.d.guild_id);
    switch(event.t) {
      case "GUILD_SCHEDULED_EVENT_CREATE":
        guild.roles.create({
          name: event.d.name,
          color: Math.floor(Math.random()*16777215),
          mentionable: true
        }).then(role => {
          eventToNameMap[event.d.id] = event.d.name;
          guild.members.addRole({
            role,
            user: event.d.creator_id
          })
        })
        break;
      case "GUILD_SCHEDULED_EVENT_UPDATE":
        if (event.d.status == 3 || event.d.status == 4) {
          var role = guild.roles.cache.find(role => role.name == eventToNameMap[event.d.id]);
          guild.roles.delete(role)
        } else {
          var role = guild.roles.cache.find(role => role.name == eventToNameMap[event.d.id]);
          eventToNameMap[event.d.id] = event.d.name;
          guild.roles.edit(role, {name: event.d.name})
        }

        break;
      case "GUILD_SCHEDULED_EVENT_USER_REMOVE":
        guild.scheduledEvents.fetch().then(allEvents => {
          let scheduledEvent = allEvents.find(eve => eve.id == event.d.guild_scheduled_event_id);
          if (scheduledEvent) {
            var role = guild.roles.cache.find(role => role.name == scheduledEvent.name);
            guild.members.removeRole({
              role,
              user: event.d.user_id
            })
          }
        })
        break;
      case "GUILD_SCHEDULED_EVENT_USER_ADD":
        guild.scheduledEvents.fetch().then(allEvents => {
          let scheduledEvent = allEvents.find(eve => eve.id == event.d.guild_scheduled_event_id);
          if (scheduledEvent) {
            var role = guild.roles.cache.find(role => role.name == scheduledEvent.name);
            guild.members.addRole({
              role,
              user: event.d.user_id
            })
          }
        })
        break;
      case "GUILD_SCHEDULED_EVENT_DELETE":
          var role = guild.roles.cache.find(role => role.name == event.d.name);
          guild.roles.delete(role)
        break;
      default:
        break;
    }
  }
});

manager.connect();

async function ingestCurrentEvents(guild) {
  guild.scheduledEvents.fetch().then(allEvents => {
    allEvents.each(event => {
      eventToNameMap[event.id] = event.name;
      guild.roles.create({
        name: event.name,
        color: Math.floor(Math.random()*16777215),
        mentionable: true
      }).then(role => {
        event.fetchSubscribers().then(userSet => {
          userSet.each(user => {
            guild.members.addRole({
              role,
              user: user.user.id
            })
          })
        });
      });
    })
  })
}

app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction type and data
  const { type, data, guild, guild_id } = req.body;
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    const guild = client.guilds.cache.get(guild_id)

    ingestCurrentEvents(guild);
    // "test" command
    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `ingesting current events ${getRandomEmoji()}`,
        },
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
