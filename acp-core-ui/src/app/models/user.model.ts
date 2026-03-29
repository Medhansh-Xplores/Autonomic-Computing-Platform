export interface IUser {
    id: number,
    firstName: string,
    lastName: string,
    userName: string,
    password: string,
    cognitoSession?: string,
    email: string,
}

export interface IForgot{
  sdkResponseMetadata: JSON;
  sdkHttpMetadata: JSON;
  codeDeliveryDetails: JSON;
}
