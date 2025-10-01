import { Request, Response } from 'express';
import { apiSuccess } from '../api/success.api';
import CustomError from '../errors/custom.error';
import { cartController } from './cart.controller';

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

  // The type of resource must be cart
  if (resource.typeId !== 'cart') {
    throw new CustomError(
      'InvalidInput',
      400,
      `Resource not recognized. Resource type must be cart.`
    );
  }

  const data = await cartController(action, resource);
  if (data && (data.statusCode === 201 || data.statusCode === 200)) {
    apiSuccess(data.statusCode, data.actions, response);
    return;
  }
};
