resource "aws_vpc" "main" {
  cidr_block           = var.cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(
    var.common_tags,
    {
      Name = var.vpc_name
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.common_tags,
    {
      Name = "${var.vpc_name}-igw"
    }
  )
}

# -----------------------------
# Public Subnets
# -----------------------------

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_1
  availability_zone       = var.az_1
  map_public_ip_on_launch = true

  tags = merge(
    var.common_tags,
    {
      Name = "${var.vpc_name}-public-subnet-1"
    }
  )
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_2
  availability_zone       = var.az_2
  map_public_ip_on_launch = true

  tags = merge(
    var.common_tags,
    {
      Name = "${var.vpc_name}-public-subnet-2"
    }
  )
}

# -----------------------------
# Private Subnets
# -----------------------------

resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_1
  availability_zone = var.az_1

  tags = merge(
    var.common_tags,
    {
      Name = "${var.vpc_name}-private-subnet-1"
    }
  )
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_2
  availability_zone = var.az_2

  tags = merge(
    var.common_tags,
    {
      Name = "${var.vpc_name}-private-subnet-2"
    }
  )
}

# -----------------------------
# Public Route Table
# -----------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.vpc_name}-public-rt"
    }
  )
}

# -----------------------------
# Route Table Associations
# -----------------------------

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}