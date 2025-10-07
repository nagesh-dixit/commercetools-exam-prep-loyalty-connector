import { Request, Response } from 'express';
import { apiSuccess } from '../api/success.api';
import CustomError from '../errors/custom.error';
import { cartController } from './cart.controller';
import { orderController } from './order.controller';
import { logger } from '../utils/logger.utils';

export const post = async (request: Request, response: Response) => {
  // Deserialize the action and resource from the body
  const { action, resource } = request.body;

  if (!action || !resource) {
    throw new CustomError(
      'InvalidInput',
      400,
      'Bad request - Missing body parameters.'
    );
  }

  let data;
  logger.info(`Processing action: ${action} for resource type: ${resource}`);
  // The type of resource must be cart or order
  switch (resource.typeId) {
    case 'cart':
      data = await cartController(action, resource);
      break;
    case 'order':
      data = await orderController(action, resource);
      break;
    default:
      throw new CustomError(
        'InvalidInput',
        400,
        `Resource not recognized. Resource type must be cart or order.`
      );
  }
  if (data && (data.statusCode === 201 || data.statusCode === 200)) {
    return apiSuccess(data.statusCode, data.actions, response);
  }
};
