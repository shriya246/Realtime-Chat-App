/**
 * Purpose: Publishes local no-op or optional Azure Service Bus message-delivery events.
 */

const { ServiceBusClient } = require('@azure/service-bus');

const { getConfig } = require('../config');

let serviceBusClient = null;
let sender = null;
let receiver = null;

/**
 * Returns whether Azure Service Bus delivery is enabled and configured.
 *
 * @returns {boolean} True when a connection string is provided.
 */
const isConfigured = () => {
  const { serviceBus } = getConfig();
  return serviceBus.eventPublisher === 'azure' && Boolean(serviceBus.connectionString);
};

/**
 * Returns the configured event publisher mode.
 *
 * @returns {string} Publisher mode.
 */
const getPublisherMode = () => getConfig().serviceBus.eventPublisher;

/**
 * Returns the configured queue name.
 *
 * @returns {string} Azure Service Bus queue name.
 */
const getQueueName = () => getConfig().serviceBus.queueName;

/**
 * Initializes and returns the shared Azure Service Bus client.
 *
 * @returns {ServiceBusClient|null} Client when configured, otherwise null.
 */
const getServiceBusClient = () => {
  if (!isConfigured()) {
    return null;
  }

  if (!serviceBusClient) {
    serviceBusClient = new ServiceBusClient(getConfig().serviceBus.connectionString);
  }

  return serviceBusClient;
};

/**
 * Publishes a saved message for asynchronous delivery processing.
 *
 * @param {object} message - Saved message API payload.
 * @returns {Promise<object>} Publication outcome.
 */
const sendMessage = async (message) => {
  try {
    const client = getServiceBusClient();

    if (!client) {
      return {
        published: false,
        reason: getPublisherMode() === 'azure'
          ? 'AZURE_SERVICE_BUS_NOT_CONFIGURED'
          : 'LOCAL_NOOP_EVENT_PUBLISHER'
      };
    }

    if (!sender) {
      sender = client.createSender(getQueueName());
    }

    await sender.sendMessages({
      body: message,
      contentType: 'application/json',
      messageId: message.id,
      subject: 'chat.message.delivered',
      applicationProperties: {
        conversationId: message.conversationId,
        roomId: message.roomId,
        senderId: message.sender.id
      }
    });

    return {
      published: true,
      messageId: message.id
    };
  } catch (error) {
    console.error('Azure Service Bus publish failed:', error.message);
    return {
      published: false,
      reason: 'AZURE_SERVICE_BUS_PUBLISH_FAILED'
    };
  }
};

/**
 * Subscribes a processor to queued message-delivery events.
 *
 * @param {Function} processMessage - Async message processing function.
 * @param {Function} [processError] - Async queue error handler.
 * @returns {Promise<object|null>} Subscription or null when not configured.
 */
const receiveMessages = async (processMessage, processError = async (args) => {
  console.error('Azure Service Bus receive failed:', args.error.message);
}) => {
  try {
    const client = getServiceBusClient();

    if (!client) {
      return null;
    }

    if (!receiver) {
      receiver = client.createReceiver(getQueueName());
    }

    return receiver.subscribe({
      processMessage,
      processError
    });
  } catch (error) {
    console.error('Azure Service Bus receiver setup failed:', error.message);
    throw error;
  }
};

/**
 * Closes queue resources during graceful server shutdown.
 *
 * @returns {Promise<void>} Resolves after resources close.
 */
const closeServiceBus = async () => {
  try {
    if (receiver) {
      await receiver.close();
      receiver = null;
    }

    if (sender) {
      await sender.close();
      sender = null;
    }

    if (serviceBusClient) {
      await serviceBusClient.close();
      serviceBusClient = null;
    }
  } catch (error) {
    console.error('Azure Service Bus shutdown failed:', error.message);
    throw error;
  }
};

module.exports = {
  closeServiceBus,
  receiveMessages,
  sendMessage
};
