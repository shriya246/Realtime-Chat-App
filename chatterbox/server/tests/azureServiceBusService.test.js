/**
 * Purpose: Verifies optional Azure Service Bus publishing, receiving, failures, and shutdown cleanup.
 */

const mockCloseClient = jest.fn();
const mockCloseReceiver = jest.fn();
const mockCloseSender = jest.fn();
const mockCreateReceiver = jest.fn();
const mockCreateSender = jest.fn();
const mockSendMessages = jest.fn();
const mockSubscribe = jest.fn();

jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: jest.fn().mockImplementation(() => ({
    close: mockCloseClient,
    createReceiver: mockCreateReceiver,
    createSender: mockCreateSender
  }))
}));

/**
 * Loads a fresh service instance so module-held clients do not leak across tests.
 *
 * @returns {object} Azure service module.
 */
const loadService = () => {
  jest.resetModules();
  return require('../src/services/azureServiceBusService');
};

describe('Azure Service Bus service', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnvironment };
    delete process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
    delete process.env.AZURE_SERVICE_BUS_QUEUE_NAME;
    mockCreateSender.mockReturnValue({
      close: mockCloseSender,
      sendMessages: mockSendMessages
    });
    mockCreateReceiver.mockReturnValue({
      close: mockCloseReceiver,
      subscribe: mockSubscribe
    });
    mockSendMessages.mockResolvedValue(undefined);
    mockCloseClient.mockResolvedValue(undefined);
    mockCloseReceiver.mockResolvedValue(undefined);
    mockCloseSender.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnvironment;
    jest.restoreAllMocks();
  });

  test('skips publish and receive behavior when Azure is not configured', async () => {
    const service = loadService();

    await expect(service.sendMessage({ id: 'message-1' })).resolves.toEqual({
      published: false,
      reason: 'AZURE_SERVICE_BUS_NOT_CONFIGURED'
    });
    await expect(service.receiveMessages(jest.fn())).resolves.toBeNull();
    await expect(service.closeServiceBus()).resolves.toBeUndefined();
  });

  test('publishes, subscribes, and closes configured queue resources', async () => {
    process.env.AZURE_SERVICE_BUS_CONNECTION_STRING = 'Endpoint=sb://configured/';
    process.env.AZURE_SERVICE_BUS_QUEUE_NAME = 'messages';
    const service = loadService();
    const message = {
      id: 'message-1',
      roomId: 'room-1',
      sender: { id: 'user-1' }
    };
    const processor = jest.fn();

    await expect(service.sendMessage(message)).resolves.toEqual({
      messageId: 'message-1',
      published: true
    });
    await service.receiveMessages(processor);
    await service.closeServiceBus();

    const { ServiceBusClient } = require('@azure/service-bus');
    expect(ServiceBusClient).toHaveBeenCalledWith('Endpoint=sb://configured/');
    expect(mockCreateSender).toHaveBeenCalledWith('messages');
    expect(mockSendMessages).toHaveBeenCalledWith(expect.objectContaining({ body: message }));
    expect(mockSubscribe).toHaveBeenCalledWith(expect.objectContaining({ processMessage: processor }));
    expect(mockCloseSender).toHaveBeenCalled();
    expect(mockCloseReceiver).toHaveBeenCalled();
    expect(mockCloseClient).toHaveBeenCalled();
  });

  test('reports publish failure without rejecting an already-delivered chat message', async () => {
    process.env.AZURE_SERVICE_BUS_CONNECTION_STRING = 'Endpoint=sb://configured/';
    const service = loadService();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSendMessages.mockRejectedValue(new Error('queue offline'));

    await expect(
      service.sendMessage({ id: 'message-1', roomId: 'room-1', sender: { id: 'user-1' } })
    ).resolves.toEqual({
      published: false,
      reason: 'AZURE_SERVICE_BUS_PUBLISH_FAILED'
    });
  });
});
