
region                          = "eastus"
resource_group_name             = "rg-test-aca"
container_app_name              = "test-aca"
container_app_environment_name  = "test-aca-env"
container_name                  = "app"
image                           = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
cpu                             = 0.5
memory                          = 1
port                            = 80
tags = {
  CreatedBy = "ACP-Portal"
  ZoneName  = "test-aca"
}
