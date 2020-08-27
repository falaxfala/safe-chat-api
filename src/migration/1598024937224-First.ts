import { MigrationInterface, QueryRunner, getRepository } from "typeorm";
import { User } from "../entity/User";

export class CreateAdminUser1547919837483 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    let user = new User();
    user.username = "Łukasz";
    user.surname = "Falkowski";
    user.hashPassword();
    user.role = "ADMIN";
    user.email = 'falaxfala@gmail.com'
    user.password = 'Mojehaslo1'
    const userRepository = getRepository(User);
    await userRepository.save(user);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {}
}