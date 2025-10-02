import { UpdateAction } from '@commercetools/sdk-client-v2';
import CustomError from '../errors/custom.error';
import { Cart } from '@commercetools/platform-sdk';
import { createApiRoot } from '../client/create.client';
import { logger } from '../utils/logger.utils';

/**
 * Handle the create action
 *
 * @param {Resource} resource The resource from the request body
 * @returns {object}
 */
const update = async (cart: Cart) => {
  const apiRoot = createApiRoot();
  const updateActions: Array<UpdateAction> = [];
    
  // Check if cart has a customer
  if (!cart.customerId) {
    logger.info('No customer associated with cart. Skipping bonus points calculation.');
    return { statusCode: 201, actions: updateActions };
  }

  const query = `
    query ($cartId: String!, $customerId: String!, $customObjectContainer: String!) {
      cart (id: $cartId) { 
        customLineItems { id slug } 
        totalPrice { currencyCode centAmount } 
      }
      customer (id: $customerId) { custom { customFieldsRaw { name value } } }
      customObjects (container: $customObjectContainer) { results { key value } }
    }
  `;

  const variables = {
    cartId: cart.id, 
    customerId: cart.customerId, 
    customObjectContainer: "schemas"
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

    let customObject = graphQLResponse.body.data.customObjects.results[0].value;
    let cartTotal = graphQLResponse.body.data.cart.totalPrice.centAmount;
    let oldPoints = graphQLResponse.body.data.customer.custom.customFieldsRaw[0].value;
    const earnedPoints = await calculateBonusPoints(cartTotal, customObject);
    
    // Check for existing bonus points line item
    const existingBonusLineItem = graphQLResponse.body.data.cart.customLineItems.find(
      (item: any) => item.slug === "bonus-points-earned"
    );

    if (existingBonusLineItem) {
      logger.info('Found existing bonus points line item, adding remove action');
      updateActions.push({
        action: "removeCustomLineItem",
        customLineItemId: existingBonusLineItem.id
      });
    }

    const addCustomLineItemAction: UpdateAction = {
      action: "addCustomLineItem",
      name: {
        "EN": "Bonus points earned " + earnedPoints, 
        "DE": "Bonus Punkte erhalten " + earnedPoints
      },
      money: {
        centAmount: 0,
        currencyCode: cart.totalPrice.currencyCode
      },
      slug: "bonus-points-earned",
      taxCategory: {
        typeId: "tax-category",
        key: "standard-tax"
      },
      quantity: 1,
    };

    updateActions.push(addCustomLineItemAction);

    const setCustomTypeAction = {
          action: "setCustomType",
          type: {
            key: "tt-loyalty-extension",
            typeId: 'type',
          },
          fields: {
            points: earnedPoints
          },
        };
        
    updateActions.push(setCustomTypeAction);


    return { statusCode: 201, actions: updateActions };
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
export const cartController = async (
  action: string,
  resource: Cart
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

const calculateBonusPoints = async (
    cartTotal: number,
    customObject: any
): Promise<number> => {
    let earnedPoints = 0;
    Object.entries(customObject).forEach(block =>{
        let { minCartValue, maxCartValue, factor, addon } = block[1] as cartValues;
        if(cartTotal >= minCartValue && cartTotal <= maxCartValue){
            earnedPoints = (cartTotal/100) * factor + addon;
        }
    })
    return earnedPoints;
}


export interface cartValues {
    minCartValue: number; maxCartValue: number; factor: number; addon: number;
};
