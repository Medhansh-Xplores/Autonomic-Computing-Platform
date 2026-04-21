output "cluster_id" {
  value = module.ecs_cluster.cluster_id
}

output "execution_role_arn" {
  value = module.ecs_cluster.execution_role_arn
}

output "log_group_name" {
  value = module.ecs_cluster.log_group_name
}

output "http_listener_arn" {
  value = module.ecs_cluster.http_listener_arn
}

output "security_group_id" {
  value = module.ecs_cluster.security_group_id
}

output "private_subnet_ids" {
  value = module.ecs_cluster.private_subnet_ids
}

output "alb_dns_name" {
  value = module.ecs_cluster.alb_dns_name
}