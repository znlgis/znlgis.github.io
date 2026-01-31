# NVM及NODE开发环境搭建

## 1. 安装NVM

### 1.1 下载安装包

[下载地址](https://github.com/coreybutler/nvm-windows/releases)

### 1.2 安装

双击安装包，一路下一步即可。安装完成后在终端输入nvm version，能查到版本号说明安装成功了。

## 2. 修改NVM配置

找到nvm安装路径 -> 找到 settings.txt 文件 -> 配置下载源，加在文件最后即可

```shell
node_mirror: https://npmmirror.com/mirrors/node/
npm_mirror: https://npmmirror.com/mirrors/npm/
```

## 3. 安装NODE

### 3.1 查看可安装版本

在终端输入 nvm list available， 查看网络可以安装的版本。

### 3.2 安装指定版本

选择一个版本安装，比如 nvm install 20.15.0

安装完成后必须执行命令使用该版本，比如 nvm use 20.15.0

## 4. 配置系统变量

打开系统变量可以看到多了NVM_HOME和NVM_SYMLINK两个变量，如果没有就手动添加。

NVM_HOME: nvm安装路径

NVM_SYMLINK：nvm 配置 nodejs 的软链接，nvm use 版本号 时会自动创建

## 5. 配置NPM镜像源

```shell
    npm config set registry http://registry.npmmirror.com
```

## 测试安装结果

在终端输入 node -v 和 npm -v，能查到版本号说明安装成功了。

## 6. 配置 node 的 prefix（全局路径）和 cache（缓存路径）

这里的环境配置主要配置的是npm安装的全局模块所在的路径，以及缓存cache的路径，之所以要配置，是因为npm install express [-g] 执行全局安装语句时，会将安装的模块安装到【C:\Users\用户名\AppData\Roaming\npm】路径目录下，久而久之C盘很容易被占满（C盘足够大可以无视此步骤），通过设置，将默认安装目录和缓存日志目录重新配置到其他盘符节约C盘空间

### 6.1 配置缓存文件路径（必须为绝对路径）

```shell
    npm config set cache "C:\nvm4w\nodejs\node_cache"
```

### 6.2 配置全局模块路径（必须为绝对路径）

```shell
    npm config set prefix "C:\nvm4w\nodejs\node_global"
```

### 6.3 查看配置是否生效

```shell
    npm config ls
```

### 6.4 配置环境变量

在PATH中添加全局模块路径

```shell
    %NVM_SYMLINK%\node_global
```

添加NODE_PATH系统变量
```shell
    %NVM_SYMLINK%\node_global\node_modules
```