export class ChildStatus {
    botstatus: string;
    logs?: string[];
}

export class MasterStatus {
    Email: ChildStatus;
    Cloud: ChildStatus;
    LocalBot: ChildStatus;
}

export class BotStatus {
    uuid: string;
    master: MasterStatus;
}

export class EmailArgs {

    uuid: string;
    emailAccount: string;
    emailFolder: string;
    emailPassword: string;
    emailPort: number;
    emailServer: string;
    emailRecipient: string;
    username: string;
}

export class BotInputs {
    awsAccessKey: string;
    awsSecretKey: string;
    awsBucketName: string;
    emailAccount: string;
    emailFolder: string;
    emailPassword: string;
    emailPort: number;
    emailServer: string;
    emailRecipient: string;
    displayCloud: boolean;
    displayLocal: boolean;
    displayEmail: boolean;
    IMAPorPOP: boolean;
    uuid: string;
    username: string;
    localDir: string;
    jobId: string;
    microsoftOCR: boolean;
    textractOCR: boolean;
}