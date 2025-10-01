import { UpdateAction } from '@commercetools/sdk-client-v2';
import CustomError from '../errors/custom.error';
import { Cart } from '@commercetools/platform-sdk';
import { createApiRoot } from '../client/create.client';

/**
 * Handle the create action
 *
 * @param {Resource} resource The resource from the request body
 * @returns {object}
 */
const update = async (cart: Cart) => {

  const earnedPoints = await calculateBonusPoints(cart);
  const updateActions: Array<UpdateAction> = [];

  const updateAction: UpdateAction = {
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

  updateActions.push(updateAction);

  return { statusCode: 201, actions: updateActions };
};

// Controller for update actions
// const update = (resource: Resource) => {};

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
      const data = update(resource);
      return data;
    }
    case 'Update': {
      const data = update(resource);
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
    cart: Cart,
): Promise<number> => {
    const apiRoot = createApiRoot();

    const query = `
    query ($cartId: String!, $customerId: String!, $customObjectContainer: String!) {
        cart (id: $cartId) { totalPrice { currencyCode centAmount } }
        customer (id: $customer) { custom { customFieldsRaw { name value } } }
        customObjects (container: $customObjectContainer) { results { key value } }
        }
    `;

    var graphQLResponse =  await apiRoot.graphql() 
        .post({
            body: {
            query,
            variables: {cartId: cart.id, customerId: cart.customerId, customObjectContainer: "schemas"}
            }
        })
        .execute();

    let customObject = graphQLResponse.body.data.customObjects.results[0].value;
    let cartTotal = graphQLResponse.body.data.cart.totalPrice.centAmount;
    console.log("Cart total: " + cartTotal);
    let oldPoints = graphQLResponse.body.data.customer.custom.customFieldsRaw[0].value;
    
    let earnedPoints = 0;
    Object.entries(customObject).forEach(block =>{
        let { minCartValue, maxCartValue, factor, addon } = block[1] as cartValues;
        if(cartTotal >= minCartValue && cartTotal <= maxCartValue){
            earnedPoints = (cartTotal/100) * factor + addon;
        }
    })
    console.log("Earned points: " + earnedPoints);
    return earnedPoints;
}

export interface cartValues {
    minCartValue: number; maxCartValue: number; factor: number; addon: number;
};
