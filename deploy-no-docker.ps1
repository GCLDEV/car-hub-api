# Script simplificado para deploy do Car Hub API sem Docker local
# Este script transfere apenas os arquivos e faz build na EC2

param(
    [string]$SSHKey = "api-car-hub.pem"
)

# Configurações
$EC2_HOST = "ubuntu@ec2-3-235-79-223.compute-1.amazonaws.com"
$CONTAINER_NAME = "car-hub-api-container"
$REMOTE_DIR = "/home/ubuntu/car-hub-deploy"

# Cores para output
function Write-ColoredText {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-ColoredText "🚀 Deploy simplificado do Car Hub API - Build remoto na EC2..." "Blue"

# Verificar se a chave SSH existe
if (!(Test-Path $SSHKey)) {
    Write-ColoredText "❌ Arquivo de chave SSH não encontrado: $SSHKey" "Red"
    Write-ColoredText "💡 Certifique-se de que o arquivo api-car-hub.pem está no diretório atual" "Yellow"
    exit 1
}

# Verificar se SSH está disponível
if (!(Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-ColoredText "❌ SSH não está disponível." "Red"
    Write-ColoredText "💡 Instale OpenSSH: Add-WindowsCapability -Online -Name OpenSSH.Client" "Yellow"
    exit 1
}

Write-ColoredText "📁 Criando diretório remoto..." "Yellow"
ssh -i $SSHKey -o StrictHostKeyChecking=no $EC2_HOST "sudo mkdir -p $REMOTE_DIR && sudo chown ubuntu:ubuntu $REMOTE_DIR"

Write-ColoredText "📦 Criando pacote dos arquivos..." "Yellow"
# Arquivos principais para transferir
$filesToTransfer = @(
    "package.json",
    "package-lock.json", 
    "tsconfig.json",
    "Dockerfile",
    ".dockerignore"
)

# Verificar quais arquivos existem e transferir
$existingFiles = @()
foreach ($file in $filesToTransfer) {
    if (Test-Path $file) {
        $existingFiles += $file
    }
}

# Criar arquivo .env se não existir
if (!(Test-Path ".env")) {
    Write-ColoredText "📄 Criando arquivo .env básico..." "Yellow"
    $basicEnv = @"
HOST=0.0.0.0
PORT=1337
APP_KEYS=app-key-1,app-key-2,app-key-3,app-key-4
API_TOKEN_SALT=your-api-token-salt
ADMIN_JWT_SECRET=your-admin-jwt-secret
TRANSFER_TOKEN_SALT=your-transfer-token-salt
JWT_SECRET=your-jwt-secret
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
NODE_ENV=production
"@
    $basicEnv | Out-File -FilePath ".env" -Encoding UTF8
}

# Transferir arquivos principais
Write-ColoredText "⬆️ Transferindo arquivos principais..." "Yellow"
foreach ($file in $existingFiles) {
    scp -i $SSHKey -o StrictHostKeyChecking=no $file "${EC2_HOST}:${REMOTE_DIR}/"
    if ($LASTEXITCODE -eq 0) {
        Write-ColoredText "✅ Transferido: $file" "Green"
    } else {
        Write-ColoredText "❌ Erro ao transferir: $file" "Red"
    }
}

# Transferir arquivo .env
scp -i $SSHKey -o StrictHostKeyChecking=no ".env" "${EC2_HOST}:${REMOTE_DIR}/"

# Transferir diretórios
$foldersToTransfer = @("config", "src", "public")
Write-ColoredText "📂 Transferindo diretórios..." "Yellow"

foreach ($folder in $foldersToTransfer) {
    if (Test-Path $folder) {
        Write-ColoredText "📁 Transferindo: $folder" "Yellow"
        scp -r -i $SSHKey -o StrictHostKeyChecking=no $folder "${EC2_HOST}:${REMOTE_DIR}/"
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredText "✅ Transferido: $folder" "Green"
        } else {
            Write-ColoredText "❌ Erro ao transferir: $folder" "Red"
        }
    }
}

Write-ColoredText "🔧 Configurando e fazendo build na EC2..." "Yellow"

# Script para execução remota
$RemoteScript = @"
set -e

# Navegar para o diretório
cd $REMOTE_DIR

echo "📦 Instalando/atualizando sistema..."
sudo apt-get update -y

# Instalar Node.js se não estiver instalado
if ! command -v node &> /dev/null; then
    echo "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Instalar Docker se não estiver instalado
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    sudo systemctl start docker
    sudo systemctl enable docker
fi

# Aguardar Docker iniciar
sleep 5

echo "📦 Versões instaladas:"
node --version
npm --version
sudo docker --version

# Parar container anterior se existir
if [ `$(sudo docker ps -q -f name=$CONTAINER_NAME)` ]; then
    echo "🔄 Parando container anterior..."
    sudo docker stop $CONTAINER_NAME
fi

# Remover container anterior se existir
if [ `$(sudo docker ps -aq -f name=$CONTAINER_NAME)` ]; then
    echo "🗑️ Removendo container anterior..."
    sudo docker rm $CONTAINER_NAME
fi

# Remover imagem anterior se existir
if [ `$(sudo docker images -q car-hub-api:latest)` ]; then
    echo "🗑️ Removendo imagem anterior..."
    sudo docker rmi car-hub-api:latest
fi

echo "🏗️ Fazendo build da imagem Docker na EC2..."
sudo docker build -t car-hub-api:latest --target production .

# Criar diretórios necessários
mkdir -p uploads data

echo "🚀 Iniciando Car Hub API container..."
sudo docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p 80:1337 \
    -p 1337:1337 \
    -v $REMOTE_DIR/uploads:/app/public/uploads \
    -v $REMOTE_DIR/data:/app/.tmp \
    --env-file .env \
    -e NODE_ENV=production \
    -e HOST=0.0.0.0 \
    -e PORT=1337 \
    car-hub-api:latest

# Aguardar container iniciar
echo "⏳ Aguardando container iniciar..."
sleep 15

# Verificar status
echo "📊 Status do container:"
sudo docker ps | grep $CONTAINER_NAME || echo "❌ Container não está rodando"

echo "📝 Logs do container:"
sudo docker logs $CONTAINER_NAME --tail 20

echo "🔥 Configuração do firewall..."
sudo ufw allow 80
sudo ufw allow 1337

echo "✅ Deploy concluído!"
"@

# Executar script remoto
ssh -i $SSHKey -o StrictHostKeyChecking=no $EC2_HOST $RemoteScript

Write-ColoredText "✅ Deployment do Car Hub API concluído!" "Green"
Write-ColoredText "🌐 Sua API está disponível em:" "Blue"
Write-ColoredText "   http://3.235.79.223" "Green"
Write-ColoredText "   http://3.235.79.223:1337" "Green"
Write-ColoredText "   Admin: http://3.235.79.223:1337/admin" "Green"

Write-ColoredText "`n📋 Comandos úteis:" "Yellow"
Write-ColoredText "Ver logs: ssh -i $SSHKey $EC2_HOST 'sudo docker logs $CONTAINER_NAME'" "Blue"
Write-ColoredText "Ver status: ssh -i $SSHKey $EC2_HOST 'sudo docker ps'" "Blue"
Write-ColoredText "Parar API: ssh -i $SSHKey $EC2_HOST 'sudo docker stop $CONTAINER_NAME'" "Blue"
Write-ColoredText "Iniciar API: ssh -i $SSHKey $EC2_HOST 'sudo docker start $CONTAINER_NAME'" "Blue"
Write-ColoredText "Conectar via SSH: ssh -i $SSHKey $EC2_HOST" "Blue"

Write-ColoredText "`n🎉 Car Hub API deploy realizado com sucesso!" "Green"