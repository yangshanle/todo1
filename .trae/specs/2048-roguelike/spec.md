# 2048 Roguelike《数字深渊》 - Product Requirement Document

## Overview
- **Summary**: 将经典2048改造成高级Roguelike版本，加入战斗系统、技能系统、遗物系统、特殊方块系统、关卡系统和猫娘助手系统
- **Purpose**: 保留2048的核心滑动合并玩法，融入Roguelike元素，增强游戏趣味性和重玩价值
- **Target Users**: 喜欢策略游戏和Roguelike玩法的玩家

## Goals
- 保留原2048所有核心功能和UI样式
- 实现完整的Roguelike战斗系统
- 实现主动技能和被动遗物系统
- 实现猫娘助手交互系统
- 保持代码可维护性，不修改原有逻辑

## Non-Goals (Out of Scope)
- 不改变原有的4×4棋盘布局和滑动逻辑
- 不修改原有的CSS变量和配色方案
- 不添加外部依赖，保持纯HTML+CSS+JS
- 不重写整个文件，只在原有基础上扩展

## Background & Context
- 现有代码是一个简单的2048实现，有完整的滑动合并、分数系统
- 所有CSS使用已定义的变量：--bg, --card, --text, --t2, --border, --b2, --gold, --red
- 需要保持原有的圆角、浅色调风格

## Functional Requirements
- **FR-1**: 实现玩家属性系统（生命、护盾、能量）
- **FR-2**: 实现怪物系统（多种怪物类型、AI移动和攻击）
- **FR-3**: 实现主动技能系统（3个技能槽、消耗能量）
- **FR-4**: 实现被动遗物系统（最多8个，永久生效）
- **FR-5**: 实现特殊方块系统（防御、能量、治疗、诅咒方块）
- **FR-6**: 实现关卡与进度系统（无限关卡、BOSS关卡）
- **FR-7**: 实现猫娘助手「咪奈」系统（适时对话）
- **FR-8**: 实现所有新增UI界面元素

## Non-Functional Requirements
- **NFR-1**: 所有新增CSS必须放在原style标签最后
- **NFR-2**: 所有新增JS必须放在原script标签最后
- **NFR-3**: 保留原有的所有函数和变量，不修改原有逻辑
- **NFR-4**: 代码结构清晰，添加必要注释
- **NFR-5**: 完整可运行，无任何错误

## Constraints
- **Technical**: 纯HTML+CSS+JS，无外部依赖
- **Business**: 必须保留原2048的所有核心功能
- **Dependencies**: 无外部依赖

## Assumptions
- 用户使用现代浏览器，支持ES6+语法
- 移动端触摸操作在原代码中已实现
- 原有的键盘操作可以正常工作

## Acceptance Criteria

### AC-1: 保留原2048核心功能
- **Given**: 游戏启动
- **When**: 用户进行任何原有2048操作
- **Then**: 所有原有功能正常工作
- **Verification**: `human-judgment`

### AC-2: 玩家属性系统正常工作
- **Given**: 游戏开始
- **When**: 进行游戏操作
- **Then**: 生命、护盾、能量显示正确，按规则变化
- **Verification**: `human-judgment`

### AC-3: 怪物系统正常工作
- **Given**: 进入游戏关卡
- **When**: 游戏进行中
- **Then**: 怪物在棋盘上正常显示、移动、攻击玩家
- **Verification**: `human-judgment`

### AC-4: 技能系统可使用
- **Given**: 玩家有足够能量
- **When**: 点击技能按钮
- **Then**: 技能效果正常触发，能量扣除，冷却计时
- **Verification**: `human-judgment`

### AC-5: 遗物系统正常生效
- **Given**: 玩家获得遗物
- **When**: 进行相关操作
- **Then**: 遗物效果正确应用
- **Verification**: `human-judgment`

### AC-6: 特殊方块正常工作
- **Given**: 棋盘上有特殊方块
- **When**: 合并特殊方块
- **Then**: 特殊效果正确触发
- **Verification**: `human-judgment`

### AC-7: 关卡系统正常递进
- **Given**: 完成一关
- **When**: 进入下一关
- **Then**: 难度递增，怪物更强
- **Verification**: `human-judgment`

### AC-8: 猫娘助手正常对话
- **Given**: 游戏进行中
- **When**: 触发对话事件
- **Then**: 咪奈显示正确的对话内容
- **Verification**: `human-judgment`

### AC-9: UI风格与原有一致
- **Given**: 所有新增UI元素
- **When**: 用户查看界面
- **Then**: 所有元素使用原CSS变量，风格统一
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要保存本局游戏进度？
- [ ] 是否需要全局永久解锁内容？
- [ ] 是否需要多个主题切换功能？
