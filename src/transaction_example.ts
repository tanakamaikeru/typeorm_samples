import { AppDataSource } from './data-source';
import { User } from './entity/User';

const truncateTables = async () => {
  // foreignKeyを無視して無理やり初期化
  await AppDataSource.dropDatabase();
  await AppDataSource.synchronize();
}

/**
 * 複数レコードを同時Insert
 */
const saveManyAtOnce = async () => {
  const userRepo = AppDataSource.manager.getRepository(User);
  const users = [
    {
      name: 'tanaka',
      photos: [
        { url: 'photo1' },
        { url: 'photo2' }
      ]
    },
    { name: 'satou' }
  ];
  await userRepo.save(users);
  console.log('Users saved.');
  const savedUsers = await userRepo.find({ relations: ['photos'] });
  console.log('Selected users: ', savedUsers);
}

const useTransactionalManager = async () => {
  await AppDataSource.manager.transaction(
    'REPEATABLE READ', // 分離レベルの指定は任意
    async (transactionalEntityManager) => {
      const userRepo = transactionalEntityManager.getRepository(User)
      await userRepo.save({ name: 'tanaka' });
      await userRepo.save({ name: 'satou' });
      userRepo.save({ name: 'suzuki' }); // awaitしないとtransactionの外に出る
      console.log('Users saved.');
    },
  )
  const savedUsers = await AppDataSource.manager.getRepository(User).find();
  console.log('Selected users: ', savedUsers);
}

const useTransactionalManagerErrorSample = async () => {
  try {
    await AppDataSource.manager.transaction(
      async (transactionalEntityManager) => {
        const userRepo = transactionalEntityManager.getRepository(User);
        await userRepo.save({ name: 'tanaka' });
        throw new Error('Error desu.');
        await userRepo.save({ name: 'satou' });
        userRepo.save({ name: 'suzuki' });
        console.log('Users saved.');
      },
    )
  } catch (error) {
    console.log(error.message);
  }
  const savedUsers = await AppDataSource.manager.getRepository(User).find();
  console.log('Selected users: ', savedUsers);
}

const useQueryRunner = async () => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  const userRepo = queryRunner.manager.getRepository(User);

  await queryRunner.startTransaction();

  try {
    await userRepo.save({ name: 'tanaka' });
    await userRepo.save({ name: 'satou' });

    await queryRunner.commitTransaction();

    const savedUsers = await AppDataSource.manager.getRepository(User).find();
    console.log('Selected users: ', savedUsers);
  } catch (error) {
    await queryRunner.rollbackTransaction();
  } finally {
    // 作成したQueryRunnerは解放が必要
    await queryRunner.release();
  }
}


AppDataSource.initialize()
  .then(async () => {
    await truncateTables();
    await saveManyAtOnce();
    // await useTransactionalManager();
    // await useTransactionalManagerErrorSample();
    // await useQueryRunner();
  })
  .catch((error) => console.log(error))
  .finally(() => { AppDataSource.destroy() });

