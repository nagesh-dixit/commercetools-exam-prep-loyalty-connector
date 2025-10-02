import { CustomerUpdateAction, UpdateAction } from '@commercetools/platform-sdk';
import CustomError from '../errors/custom.error';
import { Order } from '@commercetools/platform-sdk';
import { createApiRoot } from '../client/create.client';
import { logger } from '../utils/logger.utils';

/**
 * Handle the create action
 *
 * @param {Resource} resource The resource from the request body
 * @returns {object}
 */
const update = async (order: Order) => {
  const apiRoot = createApiRoot();
  
logger.info('Order received for processing:', order);
  // Check if order has a customer
  if (!order.customerId) {
    logger.info('No customer associated with order. Skipping bonus points calculation.');
    return { statusCode: 201, actions: [] };
  }
logger.info('Order custom fields:', order.custom?.fields);
  let points = order.custom?.fields.points;
  
  if (!points || points <= 0) {
    logger.info('No loyalty points in this order. Skipping update.');
    return { statusCode: 201, actions: [] };
  }

  const query = `
    query ($customerId: String!) {
      customer (id: $customerId) { 
        version
        custom { customFieldsRaw { name value } } 
      }
    }
  `;

  const variables = {
    orderId: order.id,
    customerId: order.customerId
  };    

  try {
    const graphQLResponse = await apiRoot.graphql()
      .post({
        body: {
          query,
          variables
        }
      })
      .execute();

    logger.info('GraphQL raw response:', JSON.stringify(graphQLResponse.body, null, 2));

    let oldPoints = graphQLResponse.body.data.customer.custom.customFieldsRaw[0].value;
    const totalPoints = points + oldPoints;
  
    const updateActions: Array<CustomerUpdateAction> = [{
      action: "setCustomType",
      type: {
        key: "tt-loyalty-extension",
        typeId: 'type',
      },
      fields: {
        points: totalPoints
      },
    }];

    const response = await apiRoot.customers()
      .withId({ ID: order.customerId })
      .post({
        body: {
          version: graphQLResponse.body.data.customer.version,
          actions: updateActions
        }
      })
      .execute();
      
    logger.info('Customer updated successfully:', response);
    return { statusCode: 201, actions: [] };
  } catch (error) {
    logger.error('Error during update:', error);
    throw error;
  }
};



/**
 * Handle the order controller according to the action
 *
 * @param {string} action The action that comes with the request. Could be `Create` or `Update`
 * @param {Resource} resource The resource from the request body
 * @returns {Promise<object>} The data from the method that handles the action
 */
export const orderController = async (
  action: string,
  resource: Order
) => {
  switch (action) {
    case 'Create': {
      const data = await update(resource);
      return data;
    }
    case 'Update': {
      const data = await update(resource);
      return data;
    }

    default:
      throw new CustomError(
        'InvalidOperation',
        400,
        `The action is not recognized. Allowed values are 'Create' or 'Update'.`
      );
  }
};