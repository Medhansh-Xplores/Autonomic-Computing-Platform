
region              = "eastus"
resource_group_name = "rg-acp__vnet"
vnet_name           = "acp__vnet"
cidr                = "10.0.0.0/16"
subnet_name         = "default"
subnet_cidr         = "10.0.1.0/24"
tags = {
  CreatedBy = "ACP-Portal"
  ZoneName  = "acp__vnet"
}
