const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

//
const MAP_CATEGORIES = {
    'Main': [
        'Квадрики', 'ЛНС', 'Самолеты', 'Свалка', 'Бладсы', 'Большие конты', 'Грейпсид', 'Динозаврик', 'Зерно', 'Кай-Перико', 'Малые Конты', 'Мексы', 'Мирор', 'Нефть', 'Сдача мяса', 'Старая поставка', 'Стеб', 'Стройка 1', 'Стройка 2', 'ТШКА', 'Ферма не мексы',
    ]
};

// Загрузка конфигурации серверов (сохраняем в корне проекта, как и раньше)
function loadServerConfigs() {
    try {
        const configPath = path.resolve(__dirname, '..', 'serverConfigs.json');
        
        if (!fs.existsSync(configPath)) {
            console.log('Файл serverConfigs.json не найден, создаем новый...');
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        
        const data = fs.readFileSync(configPath, 'utf8');
        let configs;
        try {
            configs = JSON.parse(data);
        } catch (parseError) {
            console.error('Файл serverConfigs.json поврежден, создаем новый...');
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        
        if (typeof configs !== 'object' || configs === null) {
            console.error('Файл serverConfigs.json содержит неверную структуру, создаем новый...');
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        
        return configs;
    } catch (error) {
        console.error('Критическая ошибка при загрузке конфигураций серверов:', error);
        console.log('Создаем новый файл конфигурации...');
        try {
            const configPath = path.resolve(__dirname, '..', 'serverConfigs.json');
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        } catch (createError) {
            console.error('Не удалось создать файл конфигурации:', createError);
            return {};
        }
    }
}

// Сохранение конфигурации серверов (в корень проекта)
function saveServerConfigs(configs) {
    try {
        const configPath = path.resolve(__dirname, '..', 'serverConfigs.json');
        
        if (fs.existsSync(configPath)) {
            const backupPath = configPath + '.backup';
            fs.copyFileSync(configPath, backupPath);
        }
        
        fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
        
        const backupPath = configPath + '.backup';
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка при сохранении конфигураций серверов:', error);
        try {
            const configPath = path.resolve(__dirname, '..', 'serverConfigs.json');
            const backupPath = configPath + '.backup';
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, configPath);
                console.log('Восстановлена резервная копия конфигурации');
            }
        } catch (restoreError) {
            console.error('Не удалось восстановить резервную копию:', restoreError);
        }
        return false;
    }
}

// Проверка прав администратора
function hasAdminPermissions(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator) || 
           member.permissions.has(PermissionFlagsBits.ManageGuild) ||
           member.roles.cache.some(role => role.permissions.has(PermissionFlagsBits.Administrator));
}

// Проверка наличия любой роли из списка
function hasAnyRole(member, roleIds) {
    if (!Array.isArray(roleIds) || roleIds.length === 0) return false;
    return roleIds.some(roleId => member.roles.cache.has(roleId));
}

// Функция для получения списка участников сервера с нужными ролями
function getServerMembers(guild, allowedRoleIds) {
    const members = [];
    guild.members.cache.forEach(member => {
        if (!member.user.bot) {
            const hasAllowedRole = member.roles.cache.some(role => 
                allowedRoleIds.includes(role.id)
            );
            if (hasAllowedRole) {
                members.push({
                    label: member.displayName || member.user.username,
                    value: member.id,
                    description: `@${member.user.username}`,
                    emoji: '👤'
                });
            }
        }
    });
    members.sort((a, b) => a.label.localeCompare(b.label));
    return members.slice(0, 25);
}

// Команда /вс - выбор карты и результата
const vsCommand = {
    data: new SlashCommandBuilder()
        .setName('вс')
        .setDescription('Отчет о результате игры на карте'),
    
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        const configs = loadServerConfigs();
        const serverConfig = configs[guildId];

        if (!serverConfig || !serverConfig.gameResults) {
            await interaction.reply({
                content: '❌ Модуль отчетности результатов игр не настроен для этого сервера. Администратор должен использовать команду `/вс_настройка` для настройки.',
                flags: 64
            });
            return;
        }

        // Ограничение: только роли-«вносить данные»
        const submitterRoleIds = serverConfig.gameResults.submitterRoleIds || serverConfig.gameResults.allowedRoleIds || [];
        if (!hasAnyRole(interaction.member, submitterRoleIds)) {
            await interaction.reply({
                content: '❌ У вас нет прав вносить данные. Обратитесь к администратору.',
                flags: 64
            });
            return;
        }

        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('category_select')
            .setPlaceholder('Выберите категорию карт')
            .addOptions(
                Object.keys(MAP_CATEGORIES).map((category) => ({
                    label: category,
                    value: category,
                    description: `${MAP_CATEGORIES[category].length} карт`
                }))
            );

        const categoryRow = new ActionRowBuilder().addComponents(categorySelect);

        await interaction.reply({
            content: '🎮 **Отчет о результате игры**\n\nВыберите категорию карт для создания отчета:',
            components: [categoryRow],
            flags: 64
        });
    },

    async handleComponent(interaction, client) {
        if (interaction.customId === 'category_select') {
            const selectedCategory = interaction.values[0];
            const maps = MAP_CATEGORIES[selectedCategory];
            
            const mapSelect = new StringSelectMenuBuilder()
                .setCustomId('map_select')
                .setPlaceholder(`Выберите карту из категории "${selectedCategory}"`)
                .addOptions(
                    maps.map((map, index) => ({
                        label: map,
                        value: `${selectedCategory}:${map}`,
                        description: `Карта ${index + 1}`
                    }))
                );

            const mapRow = new ActionRowBuilder().addComponents(mapSelect);

            await interaction.update({
                content: `🗺️ **Выбрана категория:** ${selectedCategory}\n\nТеперь выберите конкретную карту:`,
                components: [mapRow]
            });
            return true;
        }

        if (interaction.customId === 'map_select') {
            const [category, selectedMap] = interaction.values[0].split(':');
            
            const winButton = new ButtonBuilder()
                .setCustomId(`result_win_${selectedMap}`)
                .setLabel('🏆 Победа')
                .setStyle(ButtonStyle.Success);

            const loseButton = new ButtonBuilder()
                .setCustomId(`result_lose_${selectedMap}`)
                .setLabel('💀 Поражение')
                .setStyle(ButtonStyle.Danger);

            const resultRow = new ActionRowBuilder().addComponents(winButton, loseButton);

            await interaction.update({
                content: `🎯 **Выбрана карта:** ${selectedMap} (${category})\n\nТеперь выберите результат игры:`,
                components: [resultRow]
            });
            return true;
        }

        if (interaction.customId.startsWith('result_')) {
            const [, result, map] = interaction.customId.split('_');
            
            const guildId = interaction.guildId;
            const configs = loadServerConfigs();
            const serverConfig = configs[guildId];

            if (!serverConfig || !serverConfig.gameResults) {
                await interaction.update({
                    content: '❌ Конфигурация не найдена. Обратитесь к администратору.',
                    components: []
                });
                return true;
            }

            // Проверка прав на внесение данных
            const submitterRoleIds = serverConfig.gameResults.submitterRoleIds || serverConfig.gameResults.allowedRoleIds || [];
            if (!hasAnyRole(interaction.member, submitterRoleIds)) {
                await interaction.reply({
                    content: '❌ У вас нет прав вносить данные. Обратитесь к администратору.',
                    flags: 64
                });
                return true;
            }

            // Список участников строим по ролям-участникам
            const participantRoleIds = serverConfig.gameResults.participantRoleIds || serverConfig.gameResults.allowedRoleIds || [];
            const members = getServerMembers(interaction.guild, participantRoleIds);
            
            if (members.length === 0) {
                await interaction.update({
                    content: '❌ Не найдено участников с разрешенными ролями. Обратитесь к администратору для настройки ролей.',
                    components: []
                });
                return true;
            }

            const playersSelect = new StringSelectMenuBuilder()
                .setCustomId(`players_select_${result}_${map}`)
                .setPlaceholder('Выберите игроков (можно выбрать несколько)')
                .setMinValues(1)
                .setMaxValues(Math.min(members.length, 10))
                .addOptions(members);

            const playersRow = new ActionRowBuilder().addComponents(playersSelect);

            await interaction.update({
                content: `🎮 **Выбран результат:** ${result === 'win' ? '🏆 Победа' : '💀 Поражение'}\n**Карта:** ${map}\n\nТеперь выберите игроков, участвовавших в игре:`,
                components: [playersRow]
            });
            return true;
        }

        if (interaction.customId.startsWith('players_select_')) {
            const [, , result, map] = interaction.customId.split('_');
            const selectedPlayerIds = interaction.values;
            
            if (selectedPlayerIds.length === 0) {
                await interaction.update({
                    content: '❌ Не выбрано ни одного игрока.',
                    components: []
                });
                return true;
            }

            const guildId = interaction.guildId;
            const configs = loadServerConfigs();
            const serverConfig = configs[guildId];

            if (!serverConfig || !serverConfig.gameResults) {
                await interaction.update({
                    content: '❌ Конфигурация не найдена. Обратитесь к администратору.',
                    components: []
                });
                return true;
            }

            try {
                // Повторная проверка прав перед отправкой
                const submitterRoleIds = serverConfig.gameResults.submitterRoleIds || serverConfig.gameResults.allowedRoleIds || [];
                if (!hasAnyRole(interaction.member, submitterRoleIds)) {
                    await interaction.reply({
                        content: '❌ У вас нет прав вносить данные. Обратитесь к администратору.',
                        flags: 64
                    });
                    return true;
                }

                const channel = await client.channels.fetch(serverConfig.gameResults.channelId);
                if (!channel) {
                    await interaction.update({
                        content: '❌ Канал для отчетов не найден. Обратитесь к администратору.',
                        components: []
                    });
                    return true;
                }

                const players = selectedPlayerIds.map(id => {
                    const member = interaction.guild.members.cache.get(id);
                    return member ? member.displayName || member.user.username : `ID: ${id}`;
                });

                const embed = new EmbedBuilder()
                    .setColor(result === 'win' ? '#00ff00' : '#ff0000')
                    .setTitle(`🎮 Результат игры на карте ${map}`)
                    .setDescription(`**Результат:** ${result === 'win' ? '🏆 Победа' : '💀 Поражение'}`)
                    .addFields(
                        { name: '👥 Участники', value: players.map(p => `• ${p}`).join('\n'), inline: false },
                        { name: '🗺️ Карта', value: map, inline: true },
                        { name: '📅 Дата', value: new Date().toLocaleString('ru-RU'), inline: true },
                        { name: '📝 Отчет составил', value: interaction.user.toString(), inline: true }
                    )
                    .setImage(result === 'win' ? serverConfig.gameResults.winPhotoUrl : serverConfig.gameResults.losePhotoUrl)
                    .setFooter({ text: 'Отчет о результате игры' })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });

                await interaction.update({
                    content: `✅ **Отчет успешно отправлен!**\n\n**Карта:** ${map}\n**Результат:** ${result === 'win' ? 'Победа' : 'Поражение'}\n**Игроки:** ${players.length}\n**Канал:** ${channel.toString()}`,
                    components: []
                });

            } catch (error) {
                console.error('Ошибка при отправке отчета:', error);
                await interaction.update({
                    content: '❌ Произошла ошибка при отправке отчета. Попробуйте позже.',
                    components: []
                });
            }
            return true;
        }

        return false;
    }
};

// Команда /вс_настройка - настройка модуля
const vsSetupCommand = {
    data: new SlashCommandBuilder()
        .setName('вс_настройка')
        .setDescription('Настройка модуля отчетности результатов игр (только для администраторов)')
        .addChannelOption(option =>
            option.setName('канал')
                .setDescription('Канал для отправки отчетов о результатах игр')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('роли_вносить')
                .setDescription('ID ролей, кто может вносить данные (через запятую)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('роли_участники')
                .setDescription('ID ролей для списка участников (через запятую)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('фото_победы')
                .setDescription('Ссылка на фото для победы')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('фото_поражения')
                .setDescription('Ссылка на фото для поражения')
                .setRequired(true)),
    
    async execute(interaction, client) {
        if (!hasAdminPermissions(interaction.member)) {
            await interaction.reply({
                content: '❌ У вас недостаточно прав для использования этой команды. Требуются права администратора.',
                flags: 64
            });
            return;
        }

        const channel = interaction.options.getChannel('канал');
        const submitterRolesText = interaction.options.getString('роли_вносить');
        const participantRolesText = interaction.options.getString('роли_участники');
        const winPhotoUrl = interaction.options.getString('фото_победы');
        const losePhotoUrl = interaction.options.getString('фото_поражения');

        if (!winPhotoUrl.startsWith('http') || !losePhotoUrl.startsWith('http')) {
            await interaction.reply({
                content: '❌ Ссылки на фото должны начинаться с http:// или https://',
                flags: 64
            });
            return;
        }

        const submitterRoleIds = submitterRolesText.split(',').map(id => id.trim()).filter(id => /^\d+$/.test(id));
        const participantRoleIds = participantRolesText.split(',').map(id => id.trim()).filter(id => /^\d+$/.test(id));

        if (submitterRoleIds.length === 0 || participantRoleIds.length === 0) {
            await interaction.reply({
                content: '❌ Укажите корректные ID ролей для вносящих данные и для списка участников (через запятую).',
                flags: 64
            });
            return;
        }

        const validSubmitterRoles = [];
        const invalidSubmitterRoleIds = [];
        for (const roleId of submitterRoleIds) {
            try {
                const role = await interaction.guild.roles.fetch(roleId);
                if (role) validSubmitterRoles.push(role); else invalidSubmitterRoleIds.push(roleId);
            } catch (_) {
                invalidSubmitterRoleIds.push(roleId);
            }
        }

        const validParticipantRoles = [];
        const invalidParticipantRoleIds = [];
        for (const roleId of participantRoleIds) {
            try {
                const role = await interaction.guild.roles.fetch(roleId);
                if (role) validParticipantRoles.push(role); else invalidParticipantRoleIds.push(roleId);
            } catch (_) {
                invalidParticipantRoleIds.push(roleId);
            }
        }

        if (validSubmitterRoles.length === 0) {
            await interaction.reply({
                content: '❌ Не найдено ни одной валидной роли, кто может вносить данные. Проверьте ID.',
                flags: 64
            });
            return;
        }

        if (validParticipantRoles.length === 0) {
            await interaction.reply({
                content: '❌ Не найдено ни одной валидной роли для списка участников. Проверьте ID.',
                flags: 64
            });
            return;
        }

        if (invalidSubmitterRoleIds.length > 0 || invalidParticipantRoleIds.length > 0) {
            const parts = [];
            if (invalidSubmitterRoleIds.length > 0) parts.push(`роль вносящих данные: ${invalidSubmitterRoleIds.join(', ')}`);
            if (invalidParticipantRoleIds.length > 0) parts.push(`роль участников: ${invalidParticipantRoleIds.join(', ')}`);
            await interaction.reply({
                content: `⚠️ Некоторые роли не найдены (${parts.join('; ')}).\n\nПродолжаем с найденными ролями.`,
                flags: 64
            });
        }

        try {
            const guildId = interaction.guildId;
            const configs = loadServerConfigs();
            
            if (!configs[guildId]) {
                configs[guildId] = {};
            }

            configs[guildId].gameResults = {
                channelId: channel.id,
                submitterRoleIds: validSubmitterRoles.map(role => role.id),
                participantRoleIds: validParticipantRoles.map(role => role.id),
                winPhotoUrl: winPhotoUrl,
                losePhotoUrl: losePhotoUrl
            };

            if (saveServerConfigs(configs)) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Настройка модуля отчетности завершена')
                    .addFields(
                        { name: '📺 Канал для отчетов', value: channel.toString(), inline: true },
                        { name: '✍️ Роли, кто может вносить', value: validSubmitterRoles.map(r => r.toString()).join(', '), inline: false },
                        { name: '👥 Роли списка участников', value: validParticipantRoles.map(r => r.toString()).join(', '), inline: false },
                        { name: '🏆 Фото победы', value: winPhotoUrl, inline: true },
                        { name: '💀 Фото поражения', value: losePhotoUrl, inline: true }
                    )
                    .setDescription('Теперь игроки могут использовать команду `/вс` для отправки отчетов о результатах игр.')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], flags: 64 });
            } else {
                await interaction.reply({
                    content: '❌ Произошла ошибка при сохранении настроек. Попробуйте позже.',
                    flags: 64
                });
            }

        } catch (error) {
            console.error('Ошибка при настройке модуля отчетности:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при настройке модуля. Попробуйте позже.',
                flags: 64
            });
        }
    }
};

module.exports = {
    commands: [vsCommand, vsSetupCommand]
};

