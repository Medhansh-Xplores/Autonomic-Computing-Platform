
region                          = "eastus"
resource_group_name             = "rg-ACP-ACA-Test"
container_app_name              = "ACP-ACA-Test"
container_app_environment_name  = "ACP-ACA-Test-env"
container_name                  = "app"
image                           = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
cpu                             = 0.5
memory                          = 1
port                            = 80
tags = {
  CreatedBy = "ACP-Portal"
  ZoneName  = "ACP-ACA-Test"
}
