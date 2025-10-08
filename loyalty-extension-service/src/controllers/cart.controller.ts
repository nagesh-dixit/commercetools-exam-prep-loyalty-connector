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

  const query = `
    query ($cartId:String!, $customObjectContainer:String!) {
      cart (id:$cartId) { 
        customLineItems { id slug } 
        totalPrice { currencyCode centAmount } 
      }
      customObjects (container:$customObjectContainer) { results { key value } }
    }
  `;

  const variables = {
    cartId:cart.id, 
    customObjectContainer:"schemas"
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
    let cartTotal = graphQLResponse.body.data.cart?.totalPrice?.centAmount ?? 0;
    if (cartTotal === 0) {
      logger.info('No total price associated with cart. Skipping cart update.');
      return { statusCode: 201, actions: [] };
    }
    const earnedPoints = await calculateBonusPoints(cartTotal, customObject);
    
    // Check for existing bonus points line item
    const existingBonusLineItem = graphQLResponse.body.data.cart.customLineItems.find(
      (item: any) => item.slug?.startsWith("bonus-points-earned")
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
      slug: "bonus-points-earned-" + earnedPoints,
      taxCategory: {
        typeId: "tax-category",
        key: "standard-tax"
      },
      quantity: 1,
    };

    updateActions.push(addCustomLineItemAction);

    const setCustomTypeAction: UpdateAction = {
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
            earnedPoints = Math.round((cartTotal/100) * factor + addon);
        }
    })
    return earnedPoints;
}


export interface cartValues {
    minCartValue: number; maxCartValue: number; factor: number; addon: number;
};
