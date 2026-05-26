
region                          = "eastus"
resource_group_name             = "rg-ACP-TEST ACA"
container_app_name              = "ACP-TEST ACA"
container_app_environment_name  = "ACP-TEST ACA-env"
container_name                  = "app"
image                           = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
cpu                             = 0.5
memory                          = 1
port                            = 80
tags = {
  CreatedBy = "ACP-Portal"
  ZoneName  = "ACP-TEST ACA"
}
