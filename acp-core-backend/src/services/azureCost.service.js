const axios = require("axios");

const AZURE_PRICES_URL = "https://prices.azure.com/api/retail/prices";
const MONTHLY_HOURS = 730;

function odataEscape(value) {
  return String(value).replace(/'/g, "''");
}

async function fetchRetailPrices(filter) {
  const url = `${AZURE_PRICES_URL}?$filter=${encodeURIComponent(filter)}`;
  const response = await axios.get(url, { timeout: 15000 });
  return response.data?.Items || [];
}

function byMeter(...needles) {
  return (item) => {
    const meter = `${item.meterName || ""} ${item.skuName || ""} ${item.productName || ""}`.toLowerCase();
    return needles.every((needle) => meter.includes(needle.toLowerCase()));
  };
}

function firstPrice(items, matcher) {
  const item = items.find((candidate) => {
    return Number(candidate.retailPrice) > 0 && matcher(candidate);
  });

  return item || null;
}

function isContainerAppsMeter(item, meterName) {
  return item.productName === "Azure Container Apps" &&
    item.meterName === meterName &&
    item.unitOfMeasure.includes("Hour") &&
    Number(item.retailPrice) > 0;
}

function lineItem(label, quantity, unit, priceItem, monthlyCost) {
  return {
    label,
    quantity,
    unit,
    unitPrice: priceItem ? Number(priceItem.retailPrice) : null,
    currency: priceItem?.currencyCode || "USD",
    meterName: priceItem?.meterName || null,
    skuName: priceItem?.skuName || null,
    productName: priceItem?.productName || null,
    monthlyCost
  };
}

async function estimateContainerApps({ region, cpu = 0.5, memory = 1 }) {
  const filter = `serviceName eq 'Azure Container Apps' and armRegionName eq '${odataEscape(region)}' and priceType eq 'Consumption'`;
  const items = await fetchRetailPrices(filter);

  const cpuPrice = firstPrice(items, (item) => isContainerAppsMeter(item, "vCPU Usage")) || firstPrice(items, byMeter("vCPU"));
  const memoryPrice = firstPrice(items, (item) => isContainerAppsMeter(item, "Memory Usage")) || firstPrice(items, byMeter("Memory"));

  const cpuMonthly = cpuPrice ? Number(cpu) * MONTHLY_HOURS * Number(cpuPrice.retailPrice) : 0;
  const memoryMonthly = memoryPrice ? Number(memory) * MONTHLY_HOURS * Number(memoryPrice.retailPrice) : 0;

  return {
    service: "Azure Container Apps",
    region,
    currency: cpuPrice?.currencyCode || memoryPrice?.currencyCode || "USD",
    monthlyHours: MONTHLY_HOURS,
    estimatedMonthlyCost: cpuMonthly + memoryMonthly,
    lineItems: [
      lineItem("vCPU usage", Number(cpu), "vCPU x hours/month", cpuPrice, cpuMonthly),
      lineItem("Memory usage", Number(memory), "GiB x hours/month", memoryPrice, memoryMonthly)
    ],
    missingMeters: [
      !cpuPrice ? "vCPU duration" : null,
      !memoryPrice ? "Memory duration" : null
    ].filter(Boolean)
  };
}

async function estimateAks({ region, nodeCount = 1, vmSize = "Standard_B2s" }) {
  const filter = `serviceName eq 'Virtual Machines' and armRegionName eq '${odataEscape(region)}' and armSkuName eq '${odataEscape(vmSize)}' and priceType eq 'Consumption'`;
  const items = await fetchRetailPrices(filter);

  const vmPrice = firstPrice(items, (item) => {
    const text = `${item.productName || ""} ${item.meterName || ""} ${item.skuName || ""}`.toLowerCase();
    return !text.includes("windows") && !text.includes("spot") && !text.includes("low priority");
  }) || firstPrice(items, () => true);

  const nodeMonthly = vmPrice ? Number(nodeCount) * MONTHLY_HOURS * Number(vmPrice.retailPrice) : 0;

  return {
    service: "Azure Kubernetes Service",
    region,
    currency: vmPrice?.currencyCode || "USD",
    monthlyHours: MONTHLY_HOURS,
    estimatedMonthlyCost: nodeMonthly,
    lineItems: [
      lineItem(`${vmSize} worker node`, Number(nodeCount), "node x hours/month", vmPrice, nodeMonthly),
      {
        label: "AKS control plane",
        quantity: 1,
        unit: "cluster",
        unitPrice: 0,
        currency: vmPrice?.currencyCode || "USD",
        meterName: "Free tier control plane",
        skuName: "Free",
        productName: "Azure Kubernetes Service",
        monthlyCost: 0
      }
    ],
    missingMeters: vmPrice ? [] : [`${vmSize} VM`]
  };
}

async function estimatePostgres({ region }) {
  const filter = `serviceName eq 'Azure Database for PostgreSQL' and armRegionName eq '${odataEscape(region)}' and priceType eq 'Consumption'`;
  const items = await fetchRetailPrices(filter);

  const computePrice = firstPrice(items, (item) => {
    const text = `${item.productName || ""} ${item.meterName || ""} ${item.skuName || ""}`.toLowerCase();
    return text.includes("flexible") && text.includes("b1ms") && !text.includes("reservation");
  }) || firstPrice(items, byMeter("B1ms"));

  const storagePrice = firstPrice(items, (item) => {
    const text = `${item.productName || ""} ${item.meterName || ""} ${item.skuName || ""}`.toLowerCase();
    return text.includes("storage") && text.includes("flexible");
  }) || firstPrice(items, byMeter("Storage"));

  const computeMonthly = computePrice ? MONTHLY_HOURS * Number(computePrice.retailPrice) : 0;
  const storageMonthly = storagePrice ? 32 * Number(storagePrice.retailPrice) : 0;

  return {
    service: "Azure Database for PostgreSQL Flexible Server",
    region,
    currency: computePrice?.currencyCode || storagePrice?.currencyCode || "USD",
    monthlyHours: MONTHLY_HOURS,
    estimatedMonthlyCost: computeMonthly + storageMonthly,
    lineItems: [
      lineItem("Burstable B1ms compute", 1, "server x hours/month", computePrice, computeMonthly),
      lineItem("Storage", 32, "GB/month", storagePrice, storageMonthly)
    ],
    missingMeters: [
      !computePrice ? "B1ms compute" : null,
      !storagePrice ? "Storage" : null
    ].filter(Boolean)
  };
}

async function estimateSqlDatabase({ region }) {
  const filter = `serviceName eq 'SQL Database' and armRegionName eq '${odataEscape(region)}' and priceType eq 'Consumption'`;
  const items = await fetchRetailPrices(filter);

  const dbPrice = firstPrice(items, (item) => {
    const text = `${item.productName || ""} ${item.meterName || ""} ${item.skuName || ""}`.toLowerCase();
    return text.includes("single") && text.includes("basic") && !text.includes("elastic");
  }) || firstPrice(items, byMeter("Basic"));

  const monthly = dbPrice ? MONTHLY_HOURS * Number(dbPrice.retailPrice) : 0;

  return {
    service: "Azure SQL Database",
    region,
    currency: dbPrice?.currencyCode || "USD",
    monthlyHours: MONTHLY_HOURS,
    estimatedMonthlyCost: monthly,
    lineItems: [
      lineItem("Basic single database", 1, "database x hours/month", dbPrice, monthly)
    ],
    missingMeters: dbPrice ? [] : ["Basic single database"]
  };
}

exports.estimateAzureInfrastructure = async (input) => {
  const type = input.type;

  if (!input.region) {
    throw new Error("region is required");
  }

  if (type === "container-apps") {
    return estimateContainerApps(input);
  }

  if (type === "aks") {
    return estimateAks(input);
  }

  if (type === "db") {
    if (input.dbEngine === "sqlserver") {
      return estimateSqlDatabase(input);
    }

    return estimatePostgres(input);
  }

  throw new Error("Unsupported Azure cost estimate type");
};
