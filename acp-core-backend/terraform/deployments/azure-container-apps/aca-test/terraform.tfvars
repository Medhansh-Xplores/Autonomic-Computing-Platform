
region                          = "eastus"
resource_group_name             = "rg-aca-test"
container_app_name              = "aca-test"
container_app_environment_name  = "aca-test-env"
container_name                  = "app"
image                           = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
cpu                             = 0.5
memory                          = 1
port                            = 80
tags = {
  CreatedBy = "ACP-Portal"
  ZoneName  = "aca-test"
}
