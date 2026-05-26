variable "rds_identifier" {}

variable "db_engine" {}

variable "db_username" {}

variable "db_password" {}

variable "initial_db_name" {
  default = ""
}

variable "create_db" {
  type    = bool
  default = false
}

variable "vpc_id" {}

variable "subnet_ids" {
  type = list(string)
}

variable "db_port" {}