output "cluster_id" {
  description = "ECS cluster ID"
  value       = aws_ecs_cluster.main.id
}

output "cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "execution_role_arn" {
  description = "ARN of the shared ECS task execution IAM role"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "log_group_name" {
  description = "CloudWatch log group name shared by all services in this cluster"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "alb_arn" {
  description = "ARN of the shared ALB"
  value       = aws_lb.ecs.arn
}

output "alb_dns_name" {
  description = "DNS name of the shared ALB"
  value       = aws_lb.ecs.dns_name
}

output "http_listener_arn" {
  description = "ARN of the shared HTTP listener — app stacks attach rules to this"
  value       = aws_lb_listener.http.arn
}

output "security_group_id" {
  description = "Shared ECS security group ID"
  value       = aws_security_group.ecs.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = data.aws_subnets.public.ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = data.aws_subnets.private.ids
}
