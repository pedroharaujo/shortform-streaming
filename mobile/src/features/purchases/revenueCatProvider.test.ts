import Purchases, {
  PRODUCT_CATEGORY,
  type CustomerInfo,
  type MakePurchaseResult,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import { createRevenueCatProvider } from './revenueCatProvider';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    PURCHASES_ERROR_CODE: {
      PURCHASE_CANCELLED_ERROR: '1',
      PURCHASE_NOT_ALLOWED_ERROR: '3',
      PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5',
    },
    isConfigured: jest.fn(),
    setLogHandler: jest.fn(),
    configure: jest.fn(),
    getAppUserID: jest.fn(),
    isAnonymous: jest.fn(),
    getCustomerInfo: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    getProducts: jest.fn(),
    purchaseStoreProduct: jest.fn(),
  },
  PRODUCT_CATEGORY: {
    NON_SUBSCRIPTION: 'NON_SUBSCRIPTION',
    SUBSCRIPTION: 'SUBSCRIPTION',
    UNKNOWN: 'UNKNOWN',
  },
}));

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const applicationId = 'com.stovio.app';
const productId = 'coins_100';
const identity = { ownerId, applicationId } as const;
const purchaseRequest = {
  ...identity,
  productId,
  store: 'PLAY_STORE',
  environment: 'SANDBOX',
} as const;

const method = (name: keyof typeof Purchases): jest.Mock => Purchases[name] as unknown as jest.Mock;

function customerInfo(originalAppUserId = ownerId): CustomerInfo {
  return { originalAppUserId } as CustomerInfo;
}

function product(overrides: Partial<PurchasesStoreProduct> = {}): PurchasesStoreProduct {
  return {
    identifier: productId,
    productCategory: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    priceString: '€1.99',
    price: 1.99,
    currencyCode: 'EUR',
    ...overrides,
  } as PurchasesStoreProduct;
}

function purchaseResult(overrides: Partial<MakePurchaseResult> = {}): MakePurchaseResult {
  return {
    productIdentifier: productId,
    customerInfo: customerInfo(),
    transaction: {
      productIdentifier: productId,
      transactionIdentifier: 'GPA.1234-5678-9012-34567',
    },
    ...overrides,
  } as MakePurchaseResult;
}

async function preparedProvider() {
  const provider = createRevenueCatProvider({
    androidSdk: 'replace-with-provider-value',
    applicationId,
    isCurrent: () => true,
  });
  await provider.prepare(identity);
  return provider;
}

beforeEach(() => {
  method('isConfigured').mockResolvedValue(false);
  method('getAppUserID').mockResolvedValue(ownerId);
  method('isAnonymous').mockResolvedValue(false);
  method('getCustomerInfo').mockResolvedValue(customerInfo());
  method('getProducts').mockResolvedValue([product()]);
  method('purchaseStoreProduct').mockResolvedValue(purchaseResult());
});

test('configures safely with a known owner and suppresses logs before setup', async () => {
  const provider = await preparedProvider();

  expect(method('setLogHandler')).toHaveBeenCalledWith(expect.any(Function));
  expect(method('setLogHandler').mock.invocationCallOrder[0]).toBeLessThan(
    method('configure').mock.invocationCallOrder[0]!,
  );
  expect(method('configure')).toHaveBeenCalledWith({
    apiKey: 'replace-with-provider-value',
    appUserID: ownerId,
    diagnosticsEnabled: false,
    automaticDeviceIdentifierCollectionEnabled: false,
  });
  expect(await provider.prepare(identity)).toEqual(identity);
  expect(method('logOut')).not.toHaveBeenCalled();
});

test('switches an already configured SDK directly and rejects an aliased identity', async () => {
  method('isConfigured').mockResolvedValue(true);
  method('getAppUserID').mockResolvedValue(otherOwner);
  method('logIn').mockResolvedValue({
    customerInfo: customerInfo(otherOwner),
    created: false,
  });
  const provider = createRevenueCatProvider({
    androidSdk: 'goog_public_sdk',
    applicationId,
    isCurrent: () => true,
  });

  await expect(provider.prepare(identity)).rejects.toThrow('Purchase provider unavailable');
  expect(method('logIn')).toHaveBeenCalledWith(ownerId);
  expect(method('configure')).not.toHaveBeenCalled();
  expect(method('logOut')).not.toHaveBeenCalled();
});

test('refuses to alias a preconfigured anonymous SDK identity', async () => {
  method('isConfigured').mockResolvedValue(true);
  method('getAppUserID').mockResolvedValue('$RCAnonymousID:foreign');
  method('isAnonymous').mockResolvedValue(true);
  const provider = createRevenueCatProvider({
    androidSdk: 'goog_public_sdk',
    applicationId,
    isCurrent: () => true,
  });

  await expect(provider.prepare(identity)).rejects.toThrow('Purchase provider unavailable');
  expect(method('logIn')).not.toHaveBeenCalled();
  expect(method('logOut')).not.toHaveBeenCalled();
});

test('projects exact store prices and only the completed transaction identifier', async () => {
  const nativeProduct = product();
  method('getProducts').mockResolvedValue([nativeProduct]);
  const provider = await preparedProvider();

  await expect(provider.getOffers({ ...identity, productIds: [productId] })).resolves.toEqual([
    {
      ...identity,
      productId,
      productType: 'consumable',
      store: 'PLAY_STORE',
      environment: 'SANDBOX',
      price: '€1.99',
      priceAmount: 1.99,
      currencyCode: 'EUR',
    },
  ]);
  await expect(provider.purchase(purchaseRequest)).resolves.toEqual({
    ...purchaseRequest,
    outcome: 'completed',
    transactionId: 'GPA.1234-5678-9012-34567',
  });
  expect(method('getProducts')).toHaveBeenCalledWith(
    [productId],
    PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
  expect(method('purchaseStoreProduct')).toHaveBeenCalledWith(nativeProduct);
});

test.each([
  product({ price: Number.NaN }),
  product({ currencyCode: 'eur' }),
  (() => {
    const value = product();
    delete (value as { currencyCode?: string }).currencyCode;
    return value;
  })(),
])(
  'keeps an offer purchasable while omitting invalid comparison metadata %#',
  async (nativeProduct) => {
    method('getProducts').mockResolvedValue([nativeProduct]);
    const provider = await preparedProvider();

    await expect(provider.getOffers({ ...identity, productIds: [productId] })).resolves.toEqual([
      {
        ...identity,
        productId,
        productType: 'consumable',
        store: 'PLAY_STORE',
        environment: 'SANDBOX',
        price: '€1.99',
      },
    ]);
  },
);

test('fails closed for a wrong owner, product, category, or post-purchase identity', async () => {
  const provider = await preparedProvider();
  await provider.getOffers({ ...identity, productIds: [productId] });

  await expect(
    provider.purchase({ ...purchaseRequest, ownerId: otherOwner }),
  ).resolves.toMatchObject({
    outcome: 'pending',
  });
  await expect(
    provider.purchase({ ...purchaseRequest, productId: 'coins_500' }),
  ).resolves.toMatchObject({
    outcome: 'pending',
  });
  expect(method('purchaseStoreProduct')).not.toHaveBeenCalled();

  method('getProducts').mockResolvedValue([
    product({ productCategory: PRODUCT_CATEGORY.SUBSCRIPTION }),
  ]);
  await expect(provider.getOffers({ ...identity, productIds: [productId] })).rejects.toThrow(
    'Purchase provider unavailable',
  );

  method('getProducts').mockResolvedValue([product()]);
  await provider.getOffers({ ...identity, productIds: [productId] });
  method('purchaseStoreProduct').mockResolvedValue(
    purchaseResult({ customerInfo: customerInfo(otherOwner) }),
  );
  await expect(provider.purchase(purchaseRequest)).resolves.toMatchObject({ outcome: 'pending' });
});

test('returns cancellation only for the explicit SDK code and masks every other error', async () => {
  const provider = await preparedProvider();
  await provider.getOffers({ ...identity, productIds: [productId] });
  method('purchaseStoreProduct').mockRejectedValueOnce({
    code: '1',
    secret: 'replace-with-provider-value',
  });

  await expect(provider.purchase(purchaseRequest)).resolves.toEqual({
    ...purchaseRequest,
    outcome: 'cancelled',
  });

  const providerError = new Error('provider detail') as Error & { code: string };
  providerError.code = '10';
  method('purchaseStoreProduct').mockRejectedValueOnce(providerError);
  await expect(provider.purchase(purchaseRequest)).resolves.toEqual({
    ...purchaseRequest,
    outcome: 'pending',
  });
});

test('keeps cancellation pending when the SDK owner changes before cancellation returns', async () => {
  const provider = await preparedProvider();
  await provider.getOffers({ ...identity, productIds: [productId] });
  method('purchaseStoreProduct').mockImplementationOnce(async () => {
    method('getAppUserID').mockResolvedValue(otherOwner);
    throw { code: '1' };
  });

  await expect(provider.purchase(purchaseRequest)).resolves.toEqual({
    ...purchaseRequest,
    outcome: 'pending',
  });
});

test.each([
  ['5', 'product_unavailable'],
  ['3', 'purchase_not_allowed'],
])('returns a scoped %s rejection only for the native purchase error', async (code, outcome) => {
  const provider = await preparedProvider();
  await provider.getOffers({ ...identity, productIds: [productId] });
  method('purchaseStoreProduct').mockRejectedValueOnce({ code, message: 'private detail' });
  expect(await provider.purchase(purchaseRequest)).toEqual({
    ...purchaseRequest,
    outcome,
  });
});

test.each(['2', '4', '6', '10', '20', 'unrecognized'])(
  'keeps uncertain native error %s pending',
  async (code) => {
    const provider = await preparedProvider();
    await provider.getOffers({ ...identity, productIds: [productId] });
    method('purchaseStoreProduct').mockRejectedValueOnce({ code });
    expect(await provider.purchase(purchaseRequest)).toEqual({
      ...purchaseRequest,
      outcome: 'pending',
    });
  },
);

test.each(['before', 'after', 'changed-owner', 'changed-session'])(
  'does not clear purchase-not-allowed across %s identity failure',
  async (when) => {
    let current = true;
    const provider = createRevenueCatProvider({
      androidSdk: 'replace-with-provider-value',
      applicationId,
      isCurrent: () => current,
    });
    await provider.prepare(identity);
    await provider.getOffers({ ...identity, productIds: [productId] });
    if (when === 'before') method('getCustomerInfo').mockRejectedValueOnce({ code: '3' });
    else
      method('purchaseStoreProduct').mockImplementationOnce(async () => {
        if (when === 'changed-owner') method('getAppUserID').mockResolvedValue(otherOwner);
        if (when === 'changed-session') current = false;
        if (when === 'after') {
          method('getAppUserID').mockRejectedValueOnce({ code: '3' });
          return purchaseResult();
        }
        throw { code: '3' };
      });
    expect(await provider.purchase(purchaseRequest)).toEqual({
      ...purchaseRequest,
      outcome: 'pending',
    });
  },
);

test.each(['before', 'after', 'changed-owner'])(
  'retains uncertainty for %s identity failure',
  async (when) => {
    const provider = await preparedProvider();
    await provider.getOffers({ ...identity, productIds: [productId] });
    if (when === 'before') method('getCustomerInfo').mockRejectedValueOnce({ code: '5' });
    else
      method('purchaseStoreProduct').mockImplementationOnce(async () => {
        if (when === 'changed-owner') {
          method('getAppUserID').mockResolvedValue(otherOwner);
          throw { code: '5' };
        }
        method('getAppUserID').mockRejectedValueOnce({ code: '5' });
        return purchaseResult();
      });
    expect(await provider.purchase(purchaseRequest)).toEqual({
      ...purchaseRequest,
      outcome: 'pending',
    });
  },
);

test('does not configure or log in after the captured app session changes', async () => {
  let current = true;
  method('isConfigured').mockImplementationOnce(async () => {
    current = false;
    return false;
  });
  const provider = createRevenueCatProvider({
    androidSdk: 'goog_public_sdk',
    applicationId,
    isCurrent: () => current,
  });
  await expect(provider.prepare(identity)).rejects.toThrow('Purchase provider unavailable');
  expect(method('configure')).not.toHaveBeenCalled();

  current = true;
  method('isConfigured').mockResolvedValue(true);
  method('getAppUserID').mockResolvedValue(otherOwner);
  method('isAnonymous').mockImplementationOnce(async () => {
    current = false;
    return false;
  });
  await expect(provider.prepare(identity)).rejects.toThrow('Purchase provider unavailable');
  expect(method('logIn')).not.toHaveBeenCalled();
});

test('does not start a native purchase when identity validation crosses a session change', async () => {
  let current = true;
  const provider = createRevenueCatProvider({
    androidSdk: 'goog_public_sdk',
    applicationId,
    isCurrent: () => current,
  });
  await provider.prepare(identity);
  await provider.getOffers({ ...identity, productIds: [productId] });
  method('getAppUserID').mockImplementationOnce(async () => {
    current = false;
    return ownerId;
  });

  await expect(provider.purchase(purchaseRequest)).resolves.toMatchObject({ outcome: 'pending' });
  expect(method('purchaseStoreProduct')).not.toHaveBeenCalled();
});
